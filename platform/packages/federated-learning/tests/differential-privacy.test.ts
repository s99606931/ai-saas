// Test Ref: MTU-N460 §differential-privacy
import { describe, it, expect } from 'vitest';
import {
  PrivacyBudget,
  DpQueryAuditor,
  laplaceNoise,
  gaussianNoise,
  privateCount,
  synthesizeHistogram,
} from '../src/index.js';

// 결정론적 RNG (재현 가능)
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('PrivacyBudget — FR-DP.3', () => {
  it('예산 내 소진 허용', () => {
    const b = new PrivacyBudget(1.0, 1e-5);
    b.spend(0.3);
    b.spend(0.4, 1e-6);
    const snap = b.snapshot();
    expect(snap.epsilonSpent).toBeCloseTo(0.7, 6);
    expect(snap.deltaSpent).toBeCloseTo(1e-6, 10);
  });

  it('예산 초과 차단', () => {
    const b = new PrivacyBudget(0.5);
    b.spend(0.3);
    expect(() => b.spend(0.3)).toThrow(/Epsilon budget/);
  });

  it('delta 초과 차단', () => {
    const b = new PrivacyBudget(10, 1e-5);
    expect(() => b.spend(0.1, 2e-5)).toThrow(/Delta budget/);
  });

  it('remaining 계산', () => {
    const b = new PrivacyBudget(1);
    b.spend(0.3);
    expect(b.remaining().epsilon).toBeCloseTo(0.7, 6);
  });
});

describe('Laplace 메커니즘 — FR-DP.1', () => {
  it('count 쿼리 노이즈 추가', () => {
    const rng = seededRng(42);
    const noisy = privateCount(100, 1.0, rng);
    expect(noisy).not.toBe(100); // 노이즈 기대
    expect(Math.abs(noisy - 100)).toBeLessThan(30); // 대체로 범위 내
  });

  it('epsilon 0 이하 거부', () => {
    expect(() => laplaceNoise(1, 0)).toThrow();
    expect(() => laplaceNoise(1, -1)).toThrow();
  });
});

describe('Gaussian 메커니즘 — FR-DP.2', () => {
  it('노이즈 샘플 생성', () => {
    const rng = seededRng(7);
    const n = gaussianNoise(1, 1, 1e-5, rng);
    expect(Number.isFinite(n)).toBe(true);
  });

  it('delta 범위 검증', () => {
    expect(() => gaussianNoise(1, 1, 0)).toThrow();
    expect(() => gaussianNoise(1, 1, 1)).toThrow();
  });
});

describe('DpQueryAuditor — FR-DP.4', () => {
  it('쿼리 기록 + 예산 차감', () => {
    const budget = new PrivacyBudget(1.0, 1e-5);
    const auditor = new DpQueryAuditor(budget);
    const rng = seededRng(5);
    auditor.runCount({
      queryType: 'active_users',
      trueCount: 500,
      epsilon: 0.1,
      actor: 'analyst',
      rng,
    });
    auditor.runGaussian({
      queryType: 'avg_age',
      trueValue: 35,
      epsilon: 0.1,
      delta: 1e-6,
      sensitivity: 1,
      actor: 'analyst',
      rng,
    });
    expect(auditor.history().length).toBe(2);
    expect(budget.snapshot().epsilonSpent).toBeCloseTo(0.2, 6);
  });

  it('예산 초과 시 쿼리 차단', () => {
    const budget = new PrivacyBudget(0.1);
    const auditor = new DpQueryAuditor(budget);
    expect(() =>
      auditor.runCount({
        queryType: 'x',
        trueCount: 10,
        epsilon: 0.5,
        actor: 'a',
      }),
    ).toThrow();
  });
});

describe('synthesizeHistogram — FR-DP.5', () => {
  it('노이즈 히스토그램 생성 — 음수 방지', () => {
    const rng = seededRng(1);
    const out = synthesizeHistogram({ a: 100, b: 50, c: 0 }, 1.0, rng);
    expect(Object.keys(out)).toEqual(['a', 'b', 'c']);
    for (const v of Object.values(out)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
