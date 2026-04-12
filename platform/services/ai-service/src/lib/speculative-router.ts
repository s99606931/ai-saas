// Speculative Decoding Router — FR-R50.1~R50.6
// Design Ref: SVC-AI-ADV-R50 DESIGN §3, §4
// Plan SC: acceptanceRate ≥ 0.65, p95 지연 50% 단축
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅
// N2SF: O등급 only

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface SpecQuery {
  text: string;
  dataGrade?: 'O' | 'C' | 'S';
  /** 쿼리 길이 힌트 (라우팅용) */
  estimatedTokens?: number;
}

export interface DraftModel {
  modelId: string;
  generate(query: string, k: number): Promise<string[]>;
}

export interface TargetVerification {
  acceptedCount: number;
  /** 거부된 위치에서 사용할 대체 토큰 */
  replacement?: string;
}

export interface TargetModel {
  modelId: string;
  verify(query: string, draftTokens: string[]): Promise<TargetVerification>;
  /** fallback 시 직접 생성 */
  generateDirect(query: string, k: number): Promise<string[]>;
}

export interface SpecConfig {
  /** draft 토큰 수 (기본 4) */
  k?: number;
  /** 채택률 임계값 (기본 0.4) */
  fallbackThreshold?: number;
  /** 통계 윈도우 (기본 100) */
  windowSize?: number;
}

export interface SpecResult {
  tokens: string[];
  acceptedCount: number;
  draftCount: number;
  fallback: boolean;
  draftModel: string | null;
  targetModel: string;
}

export interface SpecAuditEntry {
  timestamp: number;
  action: 'SPEC_SPECULATE' | 'SPEC_FALLBACK';
  draftModel: string | null;
  targetModel: string;
  k: number;
  accepted: number;
}

export interface SpecStats {
  totalSpeculations: number;
  totalFallbacks: number;
  acceptanceRate: number;
  estimatedCostSavingPct: number;
  windowSize: number;
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DEFAULT_K = 4;
const DEFAULT_FALLBACK_THRESHOLD = 0.4;
const DEFAULT_WINDOW_SIZE = 100;

// ── SpeculativeRouter ────────────────────────────────────────────────────────

/**
 * Speculative Decoding 라우터
 *
 * 작은 draft 모델로 K개 토큰을 미리 생성한 뒤, 큰 target 모델이
 * 한 번에 검증합니다. 채택된 토큰만 사용하여 비용·지연을 절감합니다.
 *
 * 채택률이 임계값 이하로 떨어지면 자동으로 fallback 모드로 전환되어
 * target 모델만 사용합니다.
 */
export class SpeculativeRouter {
  private readonly k: number;
  private readonly fallbackThreshold: number;
  private readonly windowSize: number;
  private readonly acceptanceWindow: number[] = [];
  private readonly auditLog: SpecAuditEntry[] = [];
  private totalSpeculations = 0;
  private totalFallbacks = 0;
  private fallbackMode = false;

  constructor(
    private readonly draftModels: DraftModel[],
    private readonly target: TargetModel,
    config: SpecConfig = {},
  ) {
    this.k = config.k ?? DEFAULT_K;
    this.fallbackThreshold = config.fallbackThreshold ?? DEFAULT_FALLBACK_THRESHOLD;
    this.windowSize = config.windowSize ?? DEFAULT_WINDOW_SIZE;
  }

  // ── FR-R50.1: draft 모델 선택 ─────────────────────────────────────────────

  /**
   * 쿼리 특성에 따라 draft 모델을 선택합니다.
   * fallback 모드이거나 draft 모델 없으면 null.
   */
  selectDraft(query: SpecQuery): DraftModel | null {
    if (this.fallbackMode || this.draftModels.length === 0) {
      return null;
    }
    // 짧은 쿼리는 첫 번째 draft, 긴 쿼리는 마지막 draft 선택
    const tokens = query.estimatedTokens ?? query.text.length / 4;
    if (tokens < 64) {
      return this.draftModels[0] ?? null;
    }
    return this.draftModels[this.draftModels.length - 1] ?? null;
  }

  // ── FR-R50.2/3: speculate + verify ────────────────────────────────────────

  /**
   * 쿼리에 대해 speculative decoding을 수행합니다.
   *
   * @throws SPEC_DATA_GRADE_BLOCKED — C/S등급
   */
  async speculate(query: SpecQuery): Promise<SpecResult> {
    this.assertDataGrade(query);

    const draft = this.selectDraft(query);

    // Fallback 경로
    if (!draft) {
      const tokens = await this.target.generateDirect(query.text, this.k);
      this.totalFallbacks += 1;
      this.audit({
        timestamp: Date.now(),
        action: 'SPEC_FALLBACK',
        draftModel: null,
        targetModel: this.target.modelId,
        k: this.k,
        accepted: 0,
      });
      return {
        tokens,
        acceptedCount: 0,
        draftCount: 0,
        fallback: true,
        draftModel: null,
        targetModel: this.target.modelId,
      };
    }

    // Speculative 경로
    const draftTokens = await draft.generate(query.text, this.k);
    const verification = await this.target.verify(query.text, draftTokens);
    const accepted = draftTokens.slice(0, verification.acceptedCount);

    // 거부된 토큰 자리에 target 대체 토큰 추가
    const finalTokens = [...accepted];
    if (verification.replacement && verification.acceptedCount < draftTokens.length) {
      finalTokens.push(verification.replacement);
    }

    this.totalSpeculations += 1;
    const rate = draftTokens.length > 0 ? verification.acceptedCount / draftTokens.length : 0;
    this.recordAcceptance(rate);

    // 채택률 저하 시 fallback 모드 진입
    if (this.shouldFallback()) {
      this.fallbackMode = true;
    }

    this.audit({
      timestamp: Date.now(),
      action: 'SPEC_SPECULATE',
      draftModel: draft.modelId,
      targetModel: this.target.modelId,
      k: this.k,
      accepted: verification.acceptedCount,
    });

    return {
      tokens: finalTokens,
      acceptedCount: verification.acceptedCount,
      draftCount: draftTokens.length,
      fallback: false,
      draftModel: draft.modelId,
      targetModel: this.target.modelId,
    };
  }

  // ── FR-R50.4: fallback 결정 ───────────────────────────────────────────────

  /**
   * 최근 윈도우 평균 acceptance rate가 임계값 이하면 true.
   * 윈도우가 충분히 차야(>= windowSize/2) 평가합니다.
   */
  shouldFallback(): boolean {
    if (this.acceptanceWindow.length < Math.max(1, Math.floor(this.windowSize / 2))) {
      return false;
    }
    const avg = this.windowAverage();
    return avg < this.fallbackThreshold;
  }

  /** fallback 모드 수동 해제 */
  resetFallback(): void {
    this.fallbackMode = false;
    this.acceptanceWindow.length = 0;
  }

  /** 현재 fallback 모드 여부 */
  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  // ── FR-R50.5: 통계 ───────────────────────────────────────────────────────

  stats(): SpecStats {
    const acceptanceRate = this.windowAverage();
    // 비용 절감 추정: 채택된 비율만큼 target 호출 회피
    const estimatedCostSavingPct = acceptanceRate * 100;
    return {
      totalSpeculations: this.totalSpeculations,
      totalFallbacks: this.totalFallbacks,
      acceptanceRate,
      estimatedCostSavingPct,
      windowSize: this.acceptanceWindow.length,
    };
  }

  // ── FR-R50.6: 감사 로그 ───────────────────────────────────────────────────

  audit(entry: SpecAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(): readonly SpecAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 유틸 ─────────────────────────────────────────────────────────────

  private assertDataGrade(query: SpecQuery): void {
    const grade = query.dataGrade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      throw new Error('SPEC_DATA_GRADE_BLOCKED');
    }
  }

  private recordAcceptance(rate: number): void {
    this.acceptanceWindow.push(rate);
    if (this.acceptanceWindow.length > this.windowSize) {
      this.acceptanceWindow.shift();
    }
  }

  private windowAverage(): number {
    if (this.acceptanceWindow.length === 0) {
      return 0;
    }
    const sum = this.acceptanceWindow.reduce((acc, x) => acc + x, 0);
    return sum / this.acceptanceWindow.length;
  }
}
