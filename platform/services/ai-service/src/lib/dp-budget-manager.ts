// Design Ref: MTU-N460 §차등 프라이버시 집계 고도화
// Plan SC: FR-DP.1~5
// NOTE: 기존 differential-privacy.ts는 SVC-AI-ADV-R35 구현이며,
// 본 모듈은 MTU-N460의 고도화 집계(budget-aware) 레이어로 분리된다.

export interface DpBudget {
  datasetId: string;
  epsilon: number;
  delta: number;
  consumedEpsilon: number;
  consumedDelta: number;
}

export interface QueryAuditEntry {
  queryId: string;
  mechanism: 'laplace' | 'gaussian';
  epsilonCost: number;
  deltaCost: number;
  at: string;
}

export interface SyntheticRecord {
  [key: string]: number;
}

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return (x >>> 0) / 0xffffffff;
  }
}

export class DpBudgetManager {
  private budgets = new Map<string, DpBudget>();
  private auditLog: QueryAuditEntry[] = [];

  /** FR-DP.3 예산 설정 */
  setBudget(datasetId: string, epsilon: number, delta: number): DpBudget {
    const b: DpBudget = { datasetId, epsilon, delta, consumedEpsilon: 0, consumedDelta: 0 };
    this.budgets.set(datasetId, b);
    return b;
  }

  getBudget(datasetId: string): DpBudget | undefined {
    return this.budgets.get(datasetId);
  }

  /** FR-DP.1 Laplace 메커니즘 */
  laplaceNoise(value: number, sensitivity: number, epsilon: number, seed = 42): number {
    const rng = new SeededRng(seed);
    const u = rng.next() - 0.5;
    const scale = sensitivity / epsilon;
    const safeAbs = Math.min(Math.abs(u), 0.4999);
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * safeAbs);
    return +(value + noise).toFixed(6);
  }

  applyLaplace(datasetId: string, queryId: string, value: number, sensitivity: number, epsilon: number, seed = 42): number {
    this.consume(datasetId, epsilon, 0);
    const noisy = this.laplaceNoise(value, sensitivity, epsilon, seed);
    this.audit(queryId, 'laplace', epsilon, 0);
    return noisy;
  }

  /** FR-DP.2 Gaussian 메커니즘 */
  gaussianNoise(value: number, sensitivity: number, epsilon: number, delta: number, seed = 42): number {
    const rng = new SeededRng(seed);
    const u1 = Math.max(rng.next(), 1e-9);
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const sigma = (sensitivity / epsilon) * Math.sqrt(2 * Math.log(1.25 / delta));
    return +(value + z * sigma).toFixed(6);
  }

  applyGaussian(datasetId: string, queryId: string, value: number, sensitivity: number, epsilon: number, delta: number, seed = 42): number {
    this.consume(datasetId, epsilon, delta);
    const noisy = this.gaussianNoise(value, sensitivity, epsilon, delta, seed);
    this.audit(queryId, 'gaussian', epsilon, delta);
    return noisy;
  }

  /** FR-DP.4 쿼리 감사 로그 */
  getAudit(): QueryAuditEntry[] {
    return [...this.auditLog];
  }

  /** FR-DP.5 합성 데이터 생성 (필드별 Laplace 노이즈) */
  generateSynthetic(records: SyntheticRecord[], sensitivity: number, epsilon: number, seed = 42): SyntheticRecord[] {
    const rng = new SeededRng(seed);
    return records.map((rec) => {
      const out: SyntheticRecord = {};
      for (const k of Object.keys(rec)) {
        const s = Math.floor(rng.next() * 1_000_000) + 1;
        out[k] = this.laplaceNoise(rec[k] ?? 0, sensitivity, epsilon, s);
      }
      return out;
    });
  }

  private consume(datasetId: string, epsilon: number, delta: number): void {
    const b = this.budgets.get(datasetId);
    if (!b) throw new Error('예산 미설정');
    if (b.consumedEpsilon + epsilon > b.epsilon + 1e-9) throw new Error('ε 예산 초과');
    if (b.consumedDelta + delta > b.delta + 1e-12) throw new Error('δ 예산 초과');
    b.consumedEpsilon += epsilon;
    b.consumedDelta += delta;
  }

  private audit(queryId: string, mechanism: 'laplace' | 'gaussian', e: number, d: number): void {
    this.auditLog.push({ queryId, mechanism, epsilonCost: e, deltaCost: d, at: new Date().toISOString() });
  }
}

export const dpBudgetManager = new DpBudgetManager();
