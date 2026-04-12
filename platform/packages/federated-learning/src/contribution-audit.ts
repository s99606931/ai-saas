// Design Ref: MTU-N462 §contribution-audit
// Plan SC: FR-FLA.1 ~ FR-FLA.5
//
// 참여 기관 기여도 감사 + Shapley 근사 + 보상 계산.
// 순수 통계. 외부 AI API 호출 없음.

import type { ModelUpdate } from './coordinator.js';

export interface ContributionScore {
  participantId: string;
  shapleyApprox: number; // 0~1 정규화
  contributionRatio: number; // 0~1
  ranking: number;
  isAnomaly: boolean;
}

export interface RewardEntry {
  participantId: string;
  score: number;
  reward: number;
}

// FR-FLA.2: Shapley 근사 (Leave-One-Out 기반)
// 전체 평균 모델과 참여자 i 제외 시 모델의 성능 차이로 기여도 추정.
// 실제 Shapley는 2^n 경우의 수 — LOO는 O(n) 근사.
export function shapleyApproximation(
  updates: ModelUpdate[],
  lossFn: (weights: number[]) => number,
): Map<string, number> {
  if (updates.length === 0) return new Map();

  const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
  const dim = updates[0].weights.length;

  const weightedAvg = (us: ModelUpdate[]): number[] => {
    const total = us.reduce((s, u) => s + u.sampleCount, 0);
    if (total === 0) return new Array(dim).fill(0);
    const agg = new Array<number>(dim).fill(0);
    for (const u of us) {
      const w = u.sampleCount / total;
      for (let i = 0; i < dim; i++) agg[i] += u.weights[i] * w;
    }
    return agg;
  };

  const fullAvg = weightedAvg(updates);
  const fullLoss = lossFn(fullAvg);

  const scores = new Map<string, number>();
  for (const target of updates) {
    const without = updates.filter((u) => u.participantId !== target.participantId);
    const looAvg = weightedAvg(without);
    const looLoss = lossFn(looAvg);
    // 더 큰 loss (기여자 제외 시)는 더 큰 기여도
    scores.set(target.participantId, round6(looLoss - fullLoss));
  }

  // 정규화 (음수는 0으로 클램프)
  let max = 0;
  for (const v of scores.values()) if (v > max) max = v;
  if (max > 0) {
    for (const [k, v] of scores) {
      scores.set(k, round6(Math.max(0, v) / max));
    }
  } else {
    // 모두 비슷한 기여 — 균등 분배
    const even = round6(1 / scores.size);
    for (const k of scores.keys()) scores.set(k, even);
  }

  void totalSamples;
  return scores;
}

// FR-FLA.4: 이상 업데이트 탐지 (z-score)
export function detectAnomalies(
  updates: ModelUpdate[],
  zThreshold: number = 2.5,
): Set<string> {
  if (updates.length < 3) return new Set();
  const norms = updates.map((u) => ({
    id: u.participantId,
    norm: Math.sqrt(u.weights.reduce((s, w) => s + w * w, 0)),
  }));
  const mean = norms.reduce((s, n) => s + n.norm, 0) / norms.length;
  const variance =
    norms.reduce((s, n) => s + (n.norm - mean) ** 2, 0) / norms.length;
  const std = Math.sqrt(variance);
  if (std === 0) return new Set();
  const anomalies = new Set<string>();
  for (const n of norms) {
    const z = Math.abs(n.norm - mean) / std;
    if (z > zThreshold) anomalies.add(n.id);
  }
  return anomalies;
}

// FR-FLA.1 + FR-FLA.3 + FR-FLA.5: 감사 엔트리 + ranking + 보상
export class ContributionAuditor {
  audit(
    updates: ModelUpdate[],
    lossFn: (weights: number[]) => number,
  ): ContributionScore[] {
    const shapley = shapleyApproximation(updates, lossFn);
    const anomalies = detectAnomalies(updates);
    const totalSamples = updates.reduce((s, u) => s + u.sampleCount, 0);
    const rows: ContributionScore[] = updates.map((u) => ({
      participantId: u.participantId,
      shapleyApprox: shapley.get(u.participantId) ?? 0,
      contributionRatio: totalSamples === 0 ? 0 : round6(u.sampleCount / totalSamples),
      ranking: 0,
      isAnomaly: anomalies.has(u.participantId),
    }));
    // ranking (shapley 내림차순)
    rows.sort((a, b) => b.shapleyApprox - a.shapleyApprox);
    rows.forEach((r, i) => {
      r.ranking = i + 1;
    });
    return rows;
  }

  // FR-FLA.5: 보상 계산 (총 보상 풀을 shapley 비율로 분배)
  calculateRewards(scores: ContributionScore[], totalPool: number): RewardEntry[] {
    const sum = scores.reduce((s, r) => s + (r.isAnomaly ? 0 : r.shapleyApprox), 0);
    if (sum === 0) {
      const even = totalPool / scores.length;
      return scores.map((s) => ({
        participantId: s.participantId,
        score: s.shapleyApprox,
        reward: s.isAnomaly ? 0 : Math.round(even),
      }));
    }
    return scores.map((s) => ({
      participantId: s.participantId,
      score: s.shapleyApprox,
      reward: s.isAnomaly
        ? 0
        : Math.round((s.shapleyApprox / sum) * totalPool),
    }));
  }
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
