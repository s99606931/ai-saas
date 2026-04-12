// Design Ref: MTU-N461 §strategies
// Plan SC: FR-FLS.1 ~ FR-FLS.5
//
// FedAvg 변형 집계 전략 (FedProx, SCAFFOLD 근사). 순수 수치.

import type { ModelUpdate } from './coordinator.js';

// FR-FLS.1: FedProx — proximal term μ를 고려한 가중 집계
// 간단화: 글로벌 가중치로부터의 편차에 페널티 적용 (μ 클수록 global에 가까워짐)
export function fedProxAggregate(
  updates: ModelUpdate[],
  globalWeights: number[],
  mu: number,
): number[] {
  if (updates.length === 0) throw new Error('No updates');
  const dim = globalWeights.length;
  const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
  const avg = new Array<number>(dim).fill(0);
  for (const u of updates) {
    const weight = u.sampleCount / totalSamples;
    for (let i = 0; i < dim; i++) {
      avg[i] += u.weights[i] * weight;
    }
  }
  // proximal pull: result = (1-α) * avg + α * global, α = mu/(1+mu)
  const alpha = mu / (1 + mu);
  return avg.map((v, i) => round6((1 - alpha) * v + alpha * globalWeights[i]));
}

// FR-FLS.2: SCAFFOLD — control variate 보정
// 각 참여자 control variate c_i, 글로벌 c. 업데이트: w - lr*(g - c_i + c)
// 간단화: 샘플 가중 평균 + variance correction.
export function scaffoldAggregate(
  updates: ModelUpdate[],
  controlVariates: Map<string, number[]>,
  globalControl: number[],
): number[] {
  if (updates.length === 0) throw new Error('No updates');
  const dim = globalControl.length;
  const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
  const result = new Array<number>(dim).fill(0);
  for (const u of updates) {
    const c_i = controlVariates.get(u.participantId) ?? new Array(dim).fill(0);
    const weight = u.sampleCount / totalSamples;
    for (let i = 0; i < dim; i++) {
      const corrected = u.weights[i] - c_i[i] + globalControl[i];
      result[i] += corrected * weight;
    }
  }
  return result.map((v) => round6(v));
}

export type StrategyName = 'fedavg' | 'fedprox' | 'scaffold';

export interface StrategyMetrics {
  strategy: StrategyName;
  round: number;
  avgWeight: number;
  spread: number; // 참여자 가중치 표준편차 평균
  participantCount: number;
}

// FR-FLS.3: 전략 선택 자동화
// 기관 간 데이터 분포가 불균등하면 FedProx, 매우 불균등하면 SCAFFOLD.
export function recommendStrategy(updates: ModelUpdate[]): StrategyName {
  if (updates.length < 2) return 'fedavg';
  const counts = updates.map((u) => u.sampleCount);
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  const variance =
    counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  const cv = Math.sqrt(variance) / Math.max(1, mean); // 변동계수
  if (cv > 1) return 'scaffold';
  if (cv > 0.3) return 'fedprox';
  return 'fedavg';
}

// FR-FLS.4: 벤치마크 메트릭
export function computeStrategyMetrics(
  strategy: StrategyName,
  round: number,
  updates: ModelUpdate[],
): StrategyMetrics {
  const dim = updates[0]?.weights.length ?? 0;
  let avgWeight = 0;
  let count = 0;
  for (const u of updates) {
    for (const w of u.weights) {
      avgWeight += w;
      count++;
    }
  }
  avgWeight = count === 0 ? 0 : avgWeight / count;
  // spread: 각 차원별 participant 간 표준편차 평균
  let spread = 0;
  for (let i = 0; i < dim; i++) {
    const vals = updates.map((u) => u.weights[i]);
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const v = vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length;
    spread += Math.sqrt(v);
  }
  spread = dim === 0 ? 0 : spread / dim;
  return {
    strategy,
    round,
    avgWeight: round6(avgWeight),
    spread: round6(spread),
    participantCount: updates.length,
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
