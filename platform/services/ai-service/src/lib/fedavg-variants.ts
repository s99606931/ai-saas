// Design Ref: MTU-N461 §FedAvg 변형 전략
// Plan SC: FR-FLS.1~5

export type FlStrategy = 'FedAvg' | 'FedProx' | 'SCAFFOLD';

export interface ClientUpdate {
  clientId: string;
  weights: number[];
  sampleCount: number;
  controlVariate?: number[]; // SCAFFOLD용
}

export interface StrategyResult {
  strategy: FlStrategy;
  aggregated: number[];
  rounds: number;
}

export interface BenchmarkResult {
  strategy: FlStrategy;
  finalLoss: number;
  convergenceRound: number;
  noniidScore: number;
}

export class FedAvgVariants {
  /** FedAvg 기본 (가중 평균) */
  fedAvg(global: number[], updates: ClientUpdate[]): number[] {
    const total = updates.reduce((s, u) => s + u.sampleCount, 0);
    if (total === 0) return [...global];
    return global.map((_, i) => {
      let sum = 0;
      for (const u of updates) sum += (u.weights[i] ?? 0) * (u.sampleCount / total);
      return +sum.toFixed(6);
    });
  }

  /** FR-FLS.1 FedProx (proximal term μ) */
  fedProx(global: number[], updates: ClientUpdate[], mu: number): number[] {
    const avg = this.fedAvg(global, updates);
    // proximal: 글로벌 모델 쪽으로 μ만큼 끌어당김
    return avg.map((w, i) => +((1 - mu) * w + mu * (global[i] ?? 0)).toFixed(6));
  }

  /** FR-FLS.2 SCAFFOLD (control variate 보정) */
  scaffold(global: number[], updates: ClientUpdate[], serverC: number[]): number[] {
    const avg = this.fedAvg(global, updates);
    // c_i - c 평균 보정
    const clientCMeans = new Array(global.length).fill(0);
    for (const u of updates) {
      if (u.controlVariate) {
        for (let i = 0; i < u.controlVariate.length; i++)
          clientCMeans[i] += u.controlVariate[i] ?? 0;
      }
    }
    const n = Math.max(updates.length, 1);
    return avg.map(
      (w, i) =>
        +(w - ((clientCMeans[i] ?? 0) / n - (serverC[i] ?? 0))).toFixed(6),
    );
  }

  /** FR-FLS.3 전략 자동 선택 */
  selectStrategy(noniidScore: number): FlStrategy {
    if (noniidScore < 0.2) return 'FedAvg';
    if (noniidScore < 0.5) return 'FedProx';
    return 'SCAFFOLD';
  }

  /** FR-FLS.4 벤치마크 */
  benchmark(strategies: FlStrategy[], noniidScore: number): BenchmarkResult[] {
    return strategies.map((s) => ({
      strategy: s,
      finalLoss: this.simulateLoss(s, noniidScore),
      convergenceRound: this.simulateRound(s, noniidScore),
      noniidScore,
    }));
  }

  /** FR-FLS.5 라운드별 결과 비교 */
  compareRounds(results: BenchmarkResult[]): BenchmarkResult[] {
    return [...results].sort((a, b) => a.finalLoss - b.finalLoss);
  }

  private simulateLoss(s: FlStrategy, noniid: number): number {
    const base = 0.5 - noniid * 0.2;
    if (s === 'SCAFFOLD') return +(base * 0.6).toFixed(4);
    if (s === 'FedProx') return +(base * 0.8).toFixed(4);
    return +base.toFixed(4);
  }

  private simulateRound(s: FlStrategy, noniid: number): number {
    if (s === 'SCAFFOLD') return 15 + Math.floor(noniid * 10);
    if (s === 'FedProx') return 20 + Math.floor(noniid * 15);
    return 25 + Math.floor(noniid * 20);
  }
}

export const fedavgVariants = new FedAvgVariants();
