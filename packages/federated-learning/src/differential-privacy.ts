/**
 * 차등 프라이버시 (Laplace/Gaussian + ε-δ 예산)
 * Design Ref: MTU-N460 §3
 * Plan SC: FR-DP.1~5
 */

/**
 * ε 예산 관리자 (FR-DP.3)
 */
export class PrivacyBudget {
  private used = 0;

  constructor(private readonly total: number) {
    if (total <= 0) throw new Error('ε 예산은 양수여야 합니다');
  }

  spend(amount: number): void {
    if (amount <= 0) throw new Error('소비량은 양수여야 합니다');
    if (this.used + amount > this.total) {
      throw new Error(
        `예산 초과: 잔액 ${(this.total - this.used).toFixed(4)}, 요청 ${amount}`,
      );
    }
    this.used += amount;
  }

  remaining(): number {
    return this.total - this.used;
  }

  usedAmount(): number {
    return this.used;
  }
}

/**
 * Laplace 메커니즘 (FR-DP.1)
 * - Laplace(0, sensitivity/ε) 노이즈를 통계에 추가
 */
export class LaplaceMechanism {
  /**
   * Laplace 노이즈 샘플링 (Box-Muller 유사 방식)
   */
  private sampleLaplace(scale: number): number {
    // Uniform (-0.5, 0.5) → Laplace 변환
    const u = Math.random() - 0.5;
    const sign = u >= 0 ? 1 : -1;
    return -scale * sign * Math.log(1 - 2 * Math.abs(u));
  }

  count(trueCount: number, sensitivity: number, epsilon: number): number {
    const scale = sensitivity / epsilon;
    return trueCount + this.sampleLaplace(scale);
  }

  sum(trueSum: number, sensitivity: number, epsilon: number): number {
    const scale = sensitivity / epsilon;
    return trueSum + this.sampleLaplace(scale);
  }
}

/**
 * Gaussian 메커니즘 (FR-DP.2) — DP-SGD용
 * σ ≥ sensitivity * sqrt(2 * ln(1.25/δ)) / ε
 */
export class GaussianMechanism {
  private sampleGaussian(): number {
    // Box-Muller
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  sigma(sensitivity: number, epsilon: number, delta: number): number {
    return (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
  }

  noise(sensitivity: number, epsilon: number, delta: number): number {
    return this.sampleGaussian() * this.sigma(sensitivity, epsilon, delta);
  }

  /**
   * DP-SGD 그래디언트 클리핑 + 노이즈
   */
  privatizeGradient(
    gradient: number[],
    clipNorm: number,
    epsilon: number,
    delta: number,
  ): number[] {
    // L2 클리핑
    const l2 = Math.sqrt(gradient.reduce((s, g) => s + g * g, 0));
    const scale = Math.min(1, clipNorm / Math.max(l2, 1e-12));
    const sensitivity = clipNorm;
    const sigma = this.sigma(sensitivity, epsilon, delta);
    return gradient.map((g) => g * scale + this.sampleGaussian() * sigma);
  }
}

/**
 * 쿼리 감사 (FR-DP.4)
 */
export interface DpQueryAudit {
  queryId: string;
  type: 'count' | 'sum' | 'mean' | 'gradient';
  epsilon: number;
  delta?: number;
  timestamp: string;
  actor: string;
}

export class DpQueryLogger {
  private entries: DpQueryAudit[] = [];

  log(entry: DpQueryAudit): void {
    this.entries.push({ ...entry });
  }

  all(): DpQueryAudit[] {
    return this.entries.map((e) => ({ ...e }));
  }

  totalEpsilon(): number {
    return this.entries.reduce((s, e) => s + e.epsilon, 0);
  }
}

/**
 * 합성 데이터 생성 (FR-DP.5) - 간단 히스토그램 기반
 */
export class SyntheticDataGenerator {
  private laplace = new LaplaceMechanism();

  /**
   * 히스토그램에 노이즈 추가 후 카테고리별 샘플링
   */
  generate(
    histogram: Map<string, number>,
    count: number,
    epsilon: number,
  ): string[] {
    const noisy = new Map<string, number>();
    for (const [key, value] of histogram) {
      const n = Math.max(0, this.laplace.count(value, 1, epsilon));
      noisy.set(key, n);
    }
    const total = Array.from(noisy.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];

    const samples: string[] = [];
    const cumulative: Array<{ key: string; cum: number }> = [];
    let acc = 0;
    for (const [key, value] of noisy) {
      acc += value / total;
      cumulative.push({ key, cum: acc });
    }
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const pick = cumulative.find((c) => r <= c.cum);
      samples.push(pick?.key ?? cumulative[cumulative.length - 1]?.key ?? '');
    }
    return samples;
  }
}
