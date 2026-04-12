// Self-Correction Loop (Reflexion) — FR-R53.1~R53.6
// Design Ref: SVC-AI-ADV-R53 DESIGN §2, §3, §4
// Plan SC: 환각 30% 감소, 평균 반복 < 3회
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅
// N2SF: O등급 only

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type CritiqueSeverity = 'none' | 'low' | 'medium' | 'high';

export interface CritiqueResult {
  issues: string[];
  severity: CritiqueSeverity;
}

export type GenerateFn = (query: string) => Promise<string>;
export type CritiqueFn = (query: string, response: string) => Promise<CritiqueResult>;
export type ReviseFn = (
  query: string,
  response: string,
  critique: CritiqueResult,
) => Promise<string>;

export interface SelfCorrectInput {
  query: string;
  /** 데이터 등급 (O만 허용) */
  dataGrade?: 'O' | 'C' | 'S';
  /** 최대 반복 횟수 (기본 5) */
  maxIter?: number;
}

export interface CycleHistory {
  iteration: number;
  response: string;
  critique: CritiqueResult;
}

export interface SelfCorrectResult {
  query: string;
  finalResponse: string;
  iterations: number;
  converged: boolean;
  history: CycleHistory[];
}

export interface CorrectAuditEntry {
  timestamp: number;
  action: 'CORRECT_RUN' | 'CORRECT_CRITIQUE' | 'CORRECT_REVISE';
  iteration: number;
  severity?: CritiqueSeverity;
  issueCount?: number;
}

const DEFAULT_MAX_ITER = 5;

// ── SelfCorrectionLoop ───────────────────────────────────────────────────────

/**
 * 자기 교정 루프 (Reflexion 패턴)
 *
 * 초기 응답을 생성한 뒤 비평→수정 사이클을 반복하여 품질을 개선합니다.
 * 비평 결과 issue가 0개이거나 maxIter에 도달하면 중단합니다.
 */
export class SelfCorrectionLoop {
  private readonly auditLog: CorrectAuditEntry[] = [];

  constructor(
    private readonly generate: GenerateFn,
    private readonly critique: CritiqueFn,
    private readonly revise: ReviseFn,
  ) {}

  // ── FR-R53.1: 비평 호출 ──────────────────────────────────────────────────

  /** 외부 critique 함수를 직접 호출 */
  async runCritique(query: string, response: string): Promise<CritiqueResult> {
    const result = await this.critique(query, response);
    this.audit({
      timestamp: Date.now(),
      action: 'CORRECT_CRITIQUE',
      iteration: 0,
      severity: result.severity,
      issueCount: result.issues.length,
    });
    return result;
  }

  // ── FR-R53.2: 수정 적용 ──────────────────────────────────────────────────

  async runRevise(
    query: string,
    response: string,
    critique: CritiqueResult,
  ): Promise<string> {
    const revised = await this.revise(query, response, critique);
    this.audit({
      timestamp: Date.now(),
      action: 'CORRECT_REVISE',
      iteration: 0,
      issueCount: critique.issues.length,
    });
    return revised;
  }

  // ── FR-R53.3: 수렴 판단 ──────────────────────────────────────────────────

  /**
   * 비평 결과가 수렴 상태인지 판단합니다.
   * - issues 0개 → 수렴
   * - severity 'none' → 수렴
   */
  hasConverged(critique: CritiqueResult): boolean {
    if (critique.severity === 'none') {
      return true;
    }
    if (critique.issues.length === 0) {
      return true;
    }
    return false;
  }

  // ── FR-R53.4: 메인 루프 (최대 반복 제한) ──────────────────────────────────

  /**
   * 자기 교정 루프를 실행합니다.
   *
   * @throws CORRECT_DATA_GRADE_BLOCKED — C/S등급
   */
  async run(input: SelfCorrectInput): Promise<SelfCorrectResult> {
    this.assertDataGrade(input);
    const maxIter = input.maxIter ?? DEFAULT_MAX_ITER;

    if (maxIter <= 0) {
      throw new Error('CORRECT_INVALID_MAX_ITER');
    }

    let response = await this.generate(input.query);
    const history: CycleHistory[] = [];
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < maxIter; iter += 1) {
      const crit = await this.critique(input.query, response);
      history.push({ iteration: iter, response, critique: crit });

      if (this.hasConverged(crit)) {
        converged = true;
        break;
      }

      response = await this.revise(input.query, response, crit);
    }

    this.audit({
      timestamp: Date.now(),
      action: 'CORRECT_RUN',
      iteration: iter,
      issueCount: history[history.length - 1]?.critique.issues.length ?? 0,
    });

    return {
      query: input.query,
      finalResponse: response,
      iterations: history.length,
      converged,
      history,
    };
  }

  // ── FR-R53.5: 수정 이력 ───────────────────────────────────────────────────

  /** 마지막 run의 history (run 결과 객체에 포함되지만 헬퍼) */
  static extractIssueTrend(result: SelfCorrectResult): number[] {
    return result.history.map((h) => h.critique.issues.length);
  }

  // ── FR-R53.6: 감사 로그 ───────────────────────────────────────────────────

  audit(entry: CorrectAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(): readonly CorrectAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private assertDataGrade(input: SelfCorrectInput): void {
    const grade = input.dataGrade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      throw new Error('CORRECT_DATA_GRADE_BLOCKED');
    }
  }
}
