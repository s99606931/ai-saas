// Test Ref: MTU-N462 §contribution-audit
import { describe, it, expect } from 'vitest';
import {
  ContributionAuditor,
  shapleyApproximation,
  detectAnomalies,
} from '../src/index.js';
import type { ModelUpdate } from '../src/index.js';

function upd(id: string, w: number[], samples: number): ModelUpdate {
  return { participantId: id, round: 1, weights: w, sampleCount: samples, submittedAt: '' };
}

// 더미 손실 함수 (L2 norm — 가중치가 목표 [1,1]에서 멀수록 큰 loss)
const target = [1, 1];
function lossFn(w: number[]): number {
  return Math.sqrt(w.reduce((s, v, i) => s + (v - target[i]) ** 2, 0));
}

describe('shapleyApproximation — FR-FLA.2', () => {
  it('정규화된 기여도 [0,1]', () => {
    const updates = [upd('a', [1, 1], 100), upd('b', [0, 0], 100), upd('c', [0.5, 0.5], 100)];
    const scores = shapleyApproximation(updates, lossFn);
    for (const v of scores.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('단일 참여자 빈 입력 방어', () => {
    expect(shapleyApproximation([], lossFn).size).toBe(0);
  });
});

describe('detectAnomalies — FR-FLA.4', () => {
  it('z-score 초과 시 이상 탐지', () => {
    const updates = [
      upd('a', [1, 1], 100),
      upd('b', [1, 1], 100),
      upd('c', [1, 1], 100),
      upd('d', [100, 100], 100), // 이상치
    ];
    const anomalies = detectAnomalies(updates, 1.5);
    expect(anomalies.has('d')).toBe(true);
  });

  it('참여자 3명 미만이면 탐지 불가', () => {
    const updates = [upd('a', [1, 1], 10), upd('b', [2, 2], 10)];
    expect(detectAnomalies(updates).size).toBe(0);
  });
});

describe('ContributionAuditor — FR-FLA.1/3/5', () => {
  it('audit + ranking + reward 계산', () => {
    const auditor = new ContributionAuditor();
    const updates = [
      upd('a', [1, 1], 100),
      upd('b', [0, 0], 200),
      upd('c', [0.5, 0.5], 100),
    ];
    const scores = auditor.audit(updates, lossFn);
    expect(scores.length).toBe(3);
    // ranking 1~3 부여
    expect(scores.map((s) => s.ranking).sort()).toEqual([1, 2, 3]);
    const rewards = auditor.calculateRewards(scores, 1000);
    const sum = rewards.reduce((s, r) => s + r.reward, 0);
    expect(sum).toBeLessThanOrEqual(1000);
    expect(sum).toBeGreaterThan(0);
  });

  it('이상치는 보상 0', () => {
    const auditor = new ContributionAuditor();
    const updates = [
      upd('a', [1, 1], 100),
      upd('b', [1, 1], 100),
      upd('c', [1, 1], 100),
      upd('anom', [50, 50], 100),
    ];
    const scores = auditor.audit(updates, lossFn);
    const rewards = auditor.calculateRewards(scores, 1000);
    const anom = rewards.find((r) => r.participantId === 'anom');
    expect(anom?.reward).toBe(0);
  });
});
