// Design Ref: MTU-N460 §differential-privacy
// Plan SC: FR-DP.1 ~ FR-DP.5
//
// 차등 프라이버시 메커니즘 구현 (Laplace, Gaussian) + ε·δ 예산 관리 +
// 쿼리 감사 + 합성 데이터 생성.
//
// 참고: Dwork et al. "The Algorithmic Foundations of Differential Privacy".
// 난수는 Math.random() 기반 — 프로덕션 환경에서는 crypto-util.randomFloat64 권장.

export interface DpBudget {
  epsilonSpent: number;
  epsilonCap: number;
  deltaSpent: number;
  deltaCap: number;
}

export interface DpQueryRecord {
  id: string;
  at: string;
  mechanism: 'laplace' | 'gaussian';
  epsilon: number;
  delta: number;
  sensitivity: number;
  queryType: string;
  actor: string;
}

// FR-DP.3: 예산 관리자 (ε, δ)
export class PrivacyBudget {
  private state: DpBudget;

  constructor(epsilonCap: number, deltaCap: number = 1e-5) {
    this.state = {
      epsilonSpent: 0,
      epsilonCap,
      deltaSpent: 0,
      deltaCap,
    };
  }

  spend(epsilon: number, delta: number = 0): void {
    if (epsilon < 0 || delta < 0) {
      throw new Error('Negative budget spend not allowed');
    }
    // 순차적 합성: ε, δ 단순 합산 (보수적)
    if (this.state.epsilonSpent + epsilon > this.state.epsilonCap) {
      throw new Error(
        `Epsilon budget exceeded: ${this.state.epsilonSpent} + ${epsilon} > ${this.state.epsilonCap}`,
      );
    }
    if (this.state.deltaSpent + delta > this.state.deltaCap) {
      throw new Error(
        `Delta budget exceeded: ${this.state.deltaSpent} + ${delta} > ${this.state.deltaCap}`,
      );
    }
    this.state.epsilonSpent += epsilon;
    this.state.deltaSpent += delta;
  }

  snapshot(): DpBudget {
    return { ...this.state };
  }

  remaining(): { epsilon: number; delta: number } {
    return {
      epsilon: round6(this.state.epsilonCap - this.state.epsilonSpent),
      delta: round6(this.state.deltaCap - this.state.deltaSpent),
    };
  }
}

// FR-DP.1: Laplace 메커니즘 (count/sum 쿼리)
// Lap(sensitivity / epsilon) 노이즈 추가
export function laplaceNoise(sensitivity: number, epsilon: number, rng: () => number = Math.random): number {
  if (epsilon <= 0) throw new Error('epsilon must be > 0');
  const scale = sensitivity / epsilon;
  const u = rng() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

export function privateCount(
  trueCount: number,
  epsilon: number,
  rng: () => number = Math.random,
): number {
  // count 쿼리의 민감도는 1 (하나의 레코드 추가/삭제)
  return trueCount + laplaceNoise(1, epsilon, rng);
}

export function privateSum(
  trueSum: number,
  sensitivity: number,
  epsilon: number,
  rng: () => number = Math.random,
): number {
  return trueSum + laplaceNoise(sensitivity, epsilon, rng);
}

// FR-DP.2: Gaussian 메커니즘 (DP-SGD용 — (ε, δ)-DP)
// 표준편차 σ = sensitivity * sqrt(2 * ln(1.25/δ)) / ε
export function gaussianNoise(
  sensitivity: number,
  epsilon: number,
  delta: number,
  rng: () => number = Math.random,
): number {
  if (epsilon <= 0 || delta <= 0 || delta >= 1) {
    throw new Error('Invalid epsilon/delta');
  }
  const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * sigma;
}

// FR-DP.4: 쿼리 감사 + 기본 API
export class DpQueryAuditor {
  private budget: PrivacyBudget;
  private log: DpQueryRecord[] = [];
  private nextId = 1;

  constructor(budget: PrivacyBudget) {
    this.budget = budget;
  }

  runCount(params: {
    queryType: string;
    trueCount: number;
    epsilon: number;
    sensitivity?: number;
    actor: string;
    rng?: () => number;
  }): number {
    const sensitivity = params.sensitivity ?? 1;
    this.budget.spend(params.epsilon, 0);
    this.record('laplace', params.epsilon, 0, sensitivity, params.queryType, params.actor);
    return params.trueCount + laplaceNoise(sensitivity, params.epsilon, params.rng);
  }

  runGaussian(params: {
    queryType: string;
    trueValue: number;
    epsilon: number;
    delta: number;
    sensitivity: number;
    actor: string;
    rng?: () => number;
  }): number {
    this.budget.spend(params.epsilon, params.delta);
    this.record(
      'gaussian',
      params.epsilon,
      params.delta,
      params.sensitivity,
      params.queryType,
      params.actor,
    );
    return (
      params.trueValue +
      gaussianNoise(params.sensitivity, params.epsilon, params.delta, params.rng)
    );
  }

  history(): DpQueryRecord[] {
    return this.log.map((r) => ({ ...r }));
  }

  private record(
    mechanism: DpQueryRecord['mechanism'],
    epsilon: number,
    delta: number,
    sensitivity: number,
    queryType: string,
    actor: string,
  ): void {
    const rec: DpQueryRecord = {
      id: `dp-${this.nextId++}`,
      at: new Date().toISOString(),
      mechanism,
      epsilon,
      delta,
      sensitivity,
      queryType,
      actor,
    };
    Object.freeze(rec);
    this.log.push(rec);
  }
}

// FR-DP.5: 합성 데이터 생성 (Laplace 기반 히스토그램 샘플링)
export function synthesizeHistogram(
  trueHistogram: Record<string, number>,
  epsilon: number,
  rng: () => number = Math.random,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [bucket, count] of Object.entries(trueHistogram)) {
    // 각 bucket에 Lap(1/ε) 노이즈 — 민감도 1
    out[bucket] = Math.max(0, Math.round(count + laplaceNoise(1, epsilon, rng)));
  }
  return out;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
