// Privacy-Preserving Inference — FR-R57.1~R57.6
// Design Ref: SVC-AI-ADV-R57 DESIGN §2, §3, §4
// Plan SC: 재식별 실패율 ≥ 99%, 결과 오차 ≤ 10%
// CSAP: D-09, D-12, 개인정보보호법 §23/§28-2

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface DPConfig {
  epsilon: number;
  /** δ — (ε, δ)-DP, 가우시안 전용 */
  delta?: number;
  /** Δf — 함수 민감도, 기본 1 */
  sensitivity?: number;
}

export interface PrivacyBudget {
  total: number;
  consumed: number;
  remaining: number;
}

export interface DPAuditEntry {
  timestamp: number;
  action:
    | 'LAPLACE'
    | 'GAUSSIAN'
    | 'DP_COUNT'
    | 'DP_MEAN'
    | 'K_ANON_OK'
    | 'K_ANON_FAIL'
    | 'BUDGET_CONSUMED'
    | 'BUDGET_EXCEEDED';
  detail?: string;
}

export type Rng = () => number;

// ── PrivacyPreservingInference ───────────────────────────────────────────────

/**
 * 차분 프라이버시(DP) 유틸리티와 k-익명화 검증기.
 * 난수원은 주입 가능하여 테스트 결정성을 보장합니다.
 */
export class PrivacyPreservingInference {
  private readonly budget: PrivacyBudget;
  private readonly auditLog: DPAuditEntry[] = [];
  private readonly rng: Rng;

  constructor(totalEpsilon: number, rng: Rng = Math.random) {
    if (totalEpsilon <= 0) {
      throw new Error('DP_INVALID_BUDGET');
    }
    this.budget = { total: totalEpsilon, consumed: 0, remaining: totalEpsilon };
    this.rng = rng;
  }

  // ── FR-R57.1: 라플라스 노이즈 ────────────────────────────────────────────

  laplaceNoise(config: DPConfig): number {
    if (config.epsilon <= 0) {
      throw new Error('DP_INVALID_EPSILON');
    }
    const sensitivity = config.sensitivity ?? 1;
    const b = sensitivity / config.epsilon;
    const u = this.rng() - 0.5; // (-0.5, 0.5)
    const sign = u < 0 ? -1 : 1;
    const noise = -b * sign * Math.log(1 - 2 * Math.abs(u));
    this.audit({
      timestamp: Date.now(),
      action: 'LAPLACE',
      detail: `eps=${config.epsilon}`,
    });
    return noise;
  }

  // ── FR-R57.2: 가우시안 노이즈 ────────────────────────────────────────────

  gaussianNoise(config: DPConfig): number {
    if (config.epsilon <= 0 || !config.delta || config.delta <= 0 || config.delta >= 1) {
      throw new Error('DP_INVALID_PARAMS');
    }
    const sensitivity = config.sensitivity ?? 1;
    const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / config.delta))) / config.epsilon;
    // Box-Muller
    const u1 = Math.max(this.rng(), 1e-12);
    const u2 = this.rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    this.audit({
      timestamp: Date.now(),
      action: 'GAUSSIAN',
      detail: `sigma=${sigma.toFixed(4)}`,
    });
    return z * sigma;
  }

  // ── FR-R57.3: DP 카운트/평균 ─────────────────────────────────────────────

  dpCount(trueCount: number, config: DPConfig): number {
    this.consumeBudget(config.epsilon);
    const noisy = trueCount + this.laplaceNoise(config);
    this.audit({ timestamp: Date.now(), action: 'DP_COUNT' });
    return Math.max(0, Math.round(noisy));
  }

  dpMean(values: number[], config: DPConfig): number {
    if (values.length === 0) return 0;
    this.consumeBudget(config.epsilon);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const noise = this.laplaceNoise({
      ...config,
      sensitivity: (config.sensitivity ?? 1) / values.length,
    });
    this.audit({ timestamp: Date.now(), action: 'DP_MEAN' });
    return mean + noise;
  }

  // ── FR-R57.4: k-익명화 ───────────────────────────────────────────────────

  /**
   * 각 그룹의 크기가 `k` 이상인지 검증합니다.
   * 그룹은 quasi-identifier 조합 키를 갖는 행의 집합으로 가정합니다.
   */
  checkKAnonymity(groups: Map<string, number>, k: number): boolean {
    if (k <= 0) throw new Error('DP_INVALID_K');
    for (const [, size] of groups) {
      if (size < k) {
        this.audit({
          timestamp: Date.now(),
          action: 'K_ANON_FAIL',
          detail: `size<${k}`,
        });
        return false;
      }
    }
    this.audit({ timestamp: Date.now(), action: 'K_ANON_OK' });
    return true;
  }

  // ── FR-R57.5: 엡실론 예산 ────────────────────────────────────────────────

  consumeBudget(eps: number): PrivacyBudget {
    if (eps <= 0) throw new Error('DP_INVALID_EPSILON');
    if (this.budget.remaining - eps < 0) {
      this.audit({
        timestamp: Date.now(),
        action: 'BUDGET_EXCEEDED',
        detail: `req=${eps}`,
      });
      throw new Error('DP_BUDGET_EXCEEDED');
    }
    this.budget.consumed = +(this.budget.consumed + eps).toFixed(6);
    this.budget.remaining = +(this.budget.total - this.budget.consumed).toFixed(6);
    this.audit({
      timestamp: Date.now(),
      action: 'BUDGET_CONSUMED',
      detail: `eps=${eps}`,
    });
    return { ...this.budget };
  }

  getBudget(): PrivacyBudget {
    return { ...this.budget };
  }

  // ── FR-R57.6: 감사 ───────────────────────────────────────────────────────

  getAuditLog(): readonly DPAuditEntry[] {
    return this.auditLog;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private audit(entry: DPAuditEntry): void {
    this.auditLog.push(entry);
  }
}
