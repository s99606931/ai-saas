// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R79.design.md
// Plan SC: FR-R79.1~5 (SVC-AI-ADV-R79 Speculative Decoding 가속화 엔진)
// CSAP: D-06 감사 로그
//
// Draft 소형 모델이 k 토큰 제안 → Verify 대형 모델 병렬 검증 → 수락률 기반 k 동적 조정.
// 실제 모델 호출은 주입형 함수로 추상화 (테스트 용이성 + 환경 독립).

export interface DraftFn {
  (context: string, k: number): Promise<string[]>;
}

export interface VerifyFn {
  /** 반환값: 앞에서부터 수락된 토큰 개수 (0 ≤ n ≤ candidates.length) */
  (context: string, candidates: string[]): Promise<number>;
}

export interface SpeculativeConfig {
  initialK: number;
  minK: number;
  maxK: number;
  emaAlpha: number;
  targetRate: number;
}

export interface DecodeStats {
  totalRounds: number;
  draftCalls: number;
  verifyCalls: number;
  acceptedTokens: number;
  draftedTokens: number;
  acceptanceRate: number;
  fallbackCount: number;
  currentK: number;
}

export interface DecodeResult {
  tokens: string[];
  stats: DecodeStats;
}

export interface AuditEvent {
  ts: string;
  action: 'DECODE_ROUND' | 'FALLBACK' | 'COMPLETE';
  details: Record<string, unknown>;
}

const DEFAULTS: SpeculativeConfig = {
  initialK: 4,
  minK: 2,
  maxK: 8,
  emaAlpha: 0.3,
  targetRate: 0.65,
};

export class SpeculativeDecodeAccelerator {
  private readonly config: SpeculativeConfig;
  private readonly draft: DraftFn;
  private readonly verify: VerifyFn;
  private readonly auditLog: AuditEvent[] = [];

  constructor(draft: DraftFn, verify: VerifyFn, cfg: Partial<SpeculativeConfig> = {}) {
    this.draft = draft;
    this.verify = verify;
    this.config = { ...DEFAULTS, ...cfg };
    this.validateConfig();
  }

  /** FR-R79.1~4 */
  async decode(
    prompt: string,
    maxTokens: number,
    stopToken?: string,
  ): Promise<DecodeResult> {
    let context = prompt;
    const tokens: string[] = [];
    const stats: DecodeStats = {
      totalRounds: 0,
      draftCalls: 0,
      verifyCalls: 0,
      acceptedTokens: 0,
      draftedTokens: 0,
      acceptanceRate: this.config.targetRate,
      fallbackCount: 0,
      currentK: this.config.initialK,
    };

    while (tokens.length < maxTokens) {
      stats.totalRounds += 1;
      const k = stats.currentK;
      const remaining = maxTokens - tokens.length;
      const askK = Math.min(k, remaining);

      // FR-R79.1: draft 후보 생성
      const candidates = await this.draft(context, askK);
      stats.draftCalls += 1;
      stats.draftedTokens += candidates.length;

      // FR-R79.2: verify 병렬 검증
      const accepted = await this.verify(context, candidates);
      stats.verifyCalls += 1;

      if (accepted === 0) {
        // FR-R79.4: 폴백 — verify 단독으로 1 토큰
        stats.fallbackCount += 1;
        this.log({
          ts: new Date().toISOString(),
          action: 'FALLBACK',
          details: { draftedK: askK, round: stats.totalRounds },
        });
        const fallbackCandidates = await this.draft(context, 1);
        const fallbackAccepted = await this.verify(context, fallbackCandidates);
        stats.draftCalls += 1;
        stats.verifyCalls += 1;
        stats.draftedTokens += fallbackCandidates.length;
        if (fallbackAccepted > 0) {
          const t = fallbackCandidates[0] ?? '';
          tokens.push(t);
          context += t;
          stats.acceptedTokens += 1;
          if (stopToken && t === stopToken) break;
        } else {
          // verify가 아예 아무것도 수락 안하면 종료 (안전 장치)
          break;
        }
      } else {
        // 수락된 토큰 반영
        for (let i = 0; i < accepted; i++) {
          const ci = candidates[i] ?? '';
          tokens.push(ci);
          context += ci;
          stats.acceptedTokens += 1;
          if (stopToken && ci === stopToken) {
            stats.acceptanceRate = ema(
              stats.acceptanceRate,
              accepted / askK,
              this.config.emaAlpha,
            );
            this.log({
              ts: new Date().toISOString(),
              action: 'COMPLETE',
              details: { ...stats },
            });
            return { tokens, stats };
          }
        }

        // FR-R79.3: EMA 수락률 갱신 + k 조정
        const roundRate = accepted / askK;
        stats.acceptanceRate = ema(stats.acceptanceRate, roundRate, this.config.emaAlpha);
        stats.currentK = this.adjustK(stats.currentK, stats.acceptanceRate);

        this.log({
          ts: new Date().toISOString(),
          action: 'DECODE_ROUND',
          details: {
            k: askK,
            accepted,
            rate: Number(roundRate.toFixed(3)),
            newK: stats.currentK,
            ema: Number(stats.acceptanceRate.toFixed(3)),
          },
        });
      }

      if (tokens.length >= maxTokens) break;
    }

    this.log({
      ts: new Date().toISOString(),
      action: 'COMPLETE',
      details: { ...stats },
    });
    return { tokens, stats };
  }

  /** FR-R79.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private adjustK(current: number, rate: number): number {
    const { minK, maxK, targetRate } = this.config;
    if (rate < targetRate * 0.7 && current > minK) return current - 1;
    if (rate > targetRate * 1.1 && current < maxK) return current + 1;
    return current;
  }

  private validateConfig(): void {
    const { initialK, minK, maxK, emaAlpha, targetRate } = this.config;
    if (minK < 1 || maxK < minK) throw new Error('invalid k range');
    if (initialK < minK || initialK > maxK) throw new Error('initialK out of range');
    if (emaAlpha <= 0 || emaAlpha > 1) throw new Error('emaAlpha must be in (0,1]');
    if (targetRate <= 0 || targetRate >= 1) throw new Error('targetRate must be in (0,1)');
  }

  private log(ev: AuditEvent): void {
    this.auditLog.push(ev);
  }
}

function ema(prev: number, cur: number, alpha: number): number {
  return (1 - alpha) * prev + alpha * cur;
}

export function createSpeculativeDecodeAccelerator(
  draft: DraftFn,
  verify: VerifyFn,
  cfg?: Partial<SpeculativeConfig>,
): SpeculativeDecodeAccelerator {
  return new SpeculativeDecodeAccelerator(draft, verify, cfg);
}
