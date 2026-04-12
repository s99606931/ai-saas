/**
 * FedAvg / FedProx / SCAFFOLD 전략 변형
 * Design Ref: MTU-N461 §3
 * Plan SC: FR-FLS.1~5
 */

export interface StrategyMetrics {
  round: number;
  loss: number;
  accuracy: number;
  convergenceDistance: number;
}

export abstract class FlStrategy {
  abstract name: string;
  abstract aggregate(
    globalWeights: number[],
    localUpdates: Array<{ weights: number[]; sampleCount: number }>,
  ): number[];
}

/**
 * 표준 FedAvg
 */
export class FedAvgStrategy extends FlStrategy {
  name = 'FedAvg';

  aggregate(
    _globalWeights: number[],
    localUpdates: Array<{ weights: number[]; sampleCount: number }>,
  ): number[] {
    const total = localUpdates.reduce((s, u) => s + u.sampleCount, 0);
    if (total === 0) return [];
    const dim = localUpdates[0]?.weights.length ?? 0;
    const result = new Array<number>(dim).fill(0);
    for (const update of localUpdates) {
      const w = update.sampleCount / total;
      for (let i = 0; i < dim; i++) {
        const cur = result[i] ?? 0;
        const uw = update.weights[i] ?? 0;
        result[i] = cur + uw * w;
      }
    }
    return result;
  }
}

/**
 * FedProx: 근접 정규화 μ (FR-FLS.1)
 * L(w) = F_k(w) + (μ/2) * ||w - w_global||²
 */
export class FedProxStrategy extends FlStrategy {
  name = 'FedProx';
  constructor(public mu = 0.01) {
    super();
  }

  aggregate(
    globalWeights: number[],
    localUpdates: Array<{ weights: number[]; sampleCount: number }>,
  ): number[] {
    // 근접 항: 로컬 가중치를 글로벌 쪽으로 shrink 후 FedAvg
    const shrunk = localUpdates.map((u) => ({
      weights: u.weights.map((w, i) => {
        const g = globalWeights[i] ?? 0;
        return w - this.mu * (w - g);
      }),
      sampleCount: u.sampleCount,
    }));
    return new FedAvgStrategy().aggregate(globalWeights, shrunk);
  }
}

/**
 * SCAFFOLD: control variate (FR-FLS.2)
 * Non-IID 환경 분산 보정
 */
export class ScaffoldStrategy extends FlStrategy {
  name = 'SCAFFOLD';
  private globalControl: number[] = [];

  aggregate(
    globalWeights: number[],
    localUpdates: Array<{ weights: number[]; sampleCount: number }>,
  ): number[] {
    const dim = globalWeights.length;
    if (this.globalControl.length !== dim) {
      this.globalControl = new Array<number>(dim).fill(0);
    }

    // 단순화된 SCAFFOLD: global control을 평균 편차로 업데이트
    const avgDelta = new Array<number>(dim).fill(0);
    const n = localUpdates.length;
    if (n === 0) return [...globalWeights];

    for (const update of localUpdates) {
      for (let i = 0; i < dim; i++) {
        const uw = update.weights[i] ?? 0;
        const gw = globalWeights[i] ?? 0;
        const cur = avgDelta[i] ?? 0;
        avgDelta[i] = cur + (uw - gw) / n;
      }
    }

    const next = new Array<number>(dim);
    for (let i = 0; i < dim; i++) {
      const gw = globalWeights[i] ?? 0;
      const d = avgDelta[i] ?? 0;
      const c = this.globalControl[i] ?? 0;
      next[i] = gw + d - 0.1 * c;
      this.globalControl[i] = c + d;
    }
    return next;
  }
}

/**
 * 전략 선택 헬퍼 (FR-FLS.3)
 */
export function selectStrategy(name: 'FedAvg' | 'FedProx' | 'SCAFFOLD'): FlStrategy {
  if (name === 'FedProx') return new FedProxStrategy();
  if (name === 'SCAFFOLD') return new ScaffoldStrategy();
  return new FedAvgStrategy();
}

/**
 * 벤치마크 수집기 (FR-FLS.4, FR-FLS.5)
 */
export class StrategyBenchmark {
  private metrics = new Map<string, StrategyMetrics[]>();

  record(strategyName: string, metrics: StrategyMetrics): void {
    const list = this.metrics.get(strategyName) ?? [];
    list.push({ ...metrics });
    this.metrics.set(strategyName, list);
  }

  compare(): Array<{ strategy: string; finalLoss: number; finalAccuracy: number; rounds: number }> {
    const result: Array<{ strategy: string; finalLoss: number; finalAccuracy: number; rounds: number }> = [];
    for (const [strategy, list] of this.metrics) {
      const last = list[list.length - 1];
      if (last) {
        result.push({
          strategy,
          finalLoss: last.loss,
          finalAccuracy: last.accuracy,
          rounds: list.length,
        });
      }
    }
    return result;
  }
}
