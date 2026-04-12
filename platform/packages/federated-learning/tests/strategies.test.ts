// Test Ref: MTU-N461 §strategies
import { describe, it, expect } from 'vitest';
import {
  fedProxAggregate,
  scaffoldAggregate,
  recommendStrategy,
  computeStrategyMetrics,
} from '../src/index.js';
import type { ModelUpdate } from '../src/index.js';

function upd(id: string, weights: number[], samples: number, round = 1): ModelUpdate {
  return { participantId: id, round, weights, sampleCount: samples, submittedAt: '' };
}

describe('fedProxAggregate — FR-FLS.1', () => {
  it('μ=0이면 일반 FedAvg와 동일', () => {
    const r = fedProxAggregate(
      [upd('a', [1, 0], 100), upd('b', [0, 1], 100)],
      [0, 0],
      0,
    );
    expect(r[0]).toBeCloseTo(0.5, 6);
    expect(r[1]).toBeCloseTo(0.5, 6);
  });

  it('μ>0이면 global 쪽으로 당겨짐', () => {
    const r = fedProxAggregate(
      [upd('a', [1, 0], 100)],
      [10, 10],
      1, // alpha=0.5
    );
    expect(r[0]).toBeCloseTo(0.5 * 1 + 0.5 * 10, 5);
    expect(r[1]).toBeCloseTo(0.5 * 0 + 0.5 * 10, 5);
  });
});

describe('scaffoldAggregate — FR-FLS.2', () => {
  it('control variate 0이면 FedAvg와 동일', () => {
    const cv = new Map<string, number[]>([
      ['a', [0, 0]],
      ['b', [0, 0]],
    ]);
    const r = scaffoldAggregate(
      [upd('a', [1, 0], 100), upd('b', [0, 1], 100)],
      cv,
      [0, 0],
    );
    expect(r[0]).toBeCloseTo(0.5, 6);
    expect(r[1]).toBeCloseTo(0.5, 6);
  });

  it('control variate 보정 적용', () => {
    const cv = new Map<string, number[]>([['a', [0.1, 0.1]]]);
    const r = scaffoldAggregate([upd('a', [1, 1], 100)], cv, [0.2, 0.2]);
    expect(r[0]).toBeCloseTo(1 - 0.1 + 0.2, 5);
    expect(r[1]).toBeCloseTo(1 - 0.1 + 0.2, 5);
  });
});

describe('recommendStrategy — FR-FLS.3', () => {
  it('데이터 분포 균등 → fedavg', () => {
    const s = recommendStrategy([upd('a', [1], 100), upd('b', [1], 100), upd('c', [1], 100)]);
    expect(s).toBe('fedavg');
  });

  it('약간 불균등 → fedprox', () => {
    // cv ≈ 0.47 → fedprox
    const s = recommendStrategy([upd('a', [1], 50), upd('b', [1], 100), upd('c', [1], 150)]);
    expect(s).toBe('fedprox');
  });

  it('매우 불균등 → scaffold', () => {
    const s = recommendStrategy([upd('a', [1], 10), upd('b', [1], 1000), upd('c', [1], 20)]);
    expect(s).toBe('scaffold');
  });
});

describe('computeStrategyMetrics — FR-FLS.4/5', () => {
  it('avgWeight + spread 계산', () => {
    const m = computeStrategyMetrics('fedavg', 1, [
      upd('a', [1, 0], 100),
      upd('b', [0, 1], 100),
    ]);
    expect(m.participantCount).toBe(2);
    expect(m.avgWeight).toBeCloseTo(0.5, 5);
    expect(m.spread).toBeGreaterThan(0);
  });
});
