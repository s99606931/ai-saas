import { describe, it, expect } from 'vitest';
import { PrivacyPreservingInference } from '../privacy-preserving-inference.js';

/** 시퀀스 rng — 결정성 테스트 */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0.5;
    i += 1;
    return v;
  };
}

describe('PrivacyPreservingInference 초기화', () => {
  it('음수 예산 거부', () => {
    expect(() => new PrivacyPreservingInference(-1)).toThrow('DP_INVALID_BUDGET');
  });
  it('초기 예산 설정', () => {
    const svc = new PrivacyPreservingInference(1.0);
    expect(svc.getBudget().total).toBe(1.0);
    expect(svc.getBudget().remaining).toBe(1.0);
  });
});

describe('PrivacyPreservingInference.laplaceNoise (FR-R57.1)', () => {
  it('결정론적 rng로 예측 가능한 노이즈', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.3]));
    const n = svc.laplaceNoise({ epsilon: 1 });
    expect(Number.isFinite(n)).toBe(true);
  });
  it('epsilon 0 이하 거부', () => {
    const svc = new PrivacyPreservingInference(10);
    expect(() => svc.laplaceNoise({ epsilon: 0 })).toThrow('DP_INVALID_EPSILON');
  });
  it('작은 epsilon은 큰 노이즈 경향', () => {
    const rng = seqRng([0.4]);
    const svc = new PrivacyPreservingInference(100, rng);
    const small = Math.abs(svc.laplaceNoise({ epsilon: 0.01 }));
    const rng2 = seqRng([0.4]);
    const svc2 = new PrivacyPreservingInference(100, rng2);
    const big = Math.abs(svc2.laplaceNoise({ epsilon: 10 }));
    expect(small).toBeGreaterThan(big);
  });
});

describe('PrivacyPreservingInference.gaussianNoise (FR-R57.2)', () => {
  it('delta 없으면 거부', () => {
    const svc = new PrivacyPreservingInference(10);
    expect(() => svc.gaussianNoise({ epsilon: 1 })).toThrow('DP_INVALID_PARAMS');
  });
  it('delta 유효 시 노이즈 반환', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.5, 0.5]));
    const n = svc.gaussianNoise({ epsilon: 1, delta: 1e-5 });
    expect(Number.isFinite(n)).toBe(true);
  });
});

describe('PrivacyPreservingInference.dpCount / dpMean (FR-R57.3)', () => {
  it('dpCount 음수 방지', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.99]));
    const count = svc.dpCount(5, { epsilon: 0.1 });
    expect(count).toBeGreaterThanOrEqual(0);
  });
  it('dpCount 정수 반환', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.5]));
    const count = svc.dpCount(10, { epsilon: 1 });
    expect(Number.isInteger(count)).toBe(true);
  });
  it('dpMean 빈 배열 0 반환', () => {
    const svc = new PrivacyPreservingInference(10);
    expect(svc.dpMean([], { epsilon: 1 })).toBe(0);
  });
  it('dpMean 근사 평균', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.5]));
    const m = svc.dpMean([10, 20, 30], { epsilon: 10 });
    expect(m).toBeCloseTo(20, 0);
  });
});

describe('PrivacyPreservingInference.checkKAnonymity (FR-R57.4)', () => {
  it('모든 그룹 k 이상이면 true', () => {
    const svc = new PrivacyPreservingInference(10);
    const groups = new Map([
      ['g1', 10],
      ['g2', 5],
    ]);
    expect(svc.checkKAnonymity(groups, 5)).toBe(true);
  });
  it('하나라도 k 미만이면 false', () => {
    const svc = new PrivacyPreservingInference(10);
    const groups = new Map([
      ['g1', 10],
      ['g2', 3],
    ]);
    expect(svc.checkKAnonymity(groups, 5)).toBe(false);
  });
  it('k<=0 거부', () => {
    const svc = new PrivacyPreservingInference(10);
    expect(() => svc.checkKAnonymity(new Map(), 0)).toThrow('DP_INVALID_K');
  });
});

describe('PrivacyPreservingInference.consumeBudget (FR-R57.5)', () => {
  it('정상 소비', () => {
    const svc = new PrivacyPreservingInference(1.0);
    const b = svc.consumeBudget(0.3);
    expect(b.remaining).toBeCloseTo(0.7, 5);
  });
  it('초과 소비 거부', () => {
    const svc = new PrivacyPreservingInference(1.0);
    svc.consumeBudget(0.5);
    expect(() => svc.consumeBudget(0.6)).toThrow('DP_BUDGET_EXCEEDED');
  });
  it('음수 소비 거부', () => {
    const svc = new PrivacyPreservingInference(1.0);
    expect(() => svc.consumeBudget(0)).toThrow('DP_INVALID_EPSILON');
  });
});

describe('PrivacyPreservingInference.audit (FR-R57.6)', () => {
  it('주요 액션 감사 로그', () => {
    const svc = new PrivacyPreservingInference(10, seqRng([0.5]));
    svc.dpCount(5, { epsilon: 0.5 });
    svc.checkKAnonymity(new Map([['g', 10]]), 5);
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'LAPLACE')).toBe(true);
    expect(log.some((e) => e.action === 'DP_COUNT')).toBe(true);
    expect(log.some((e) => e.action === 'BUDGET_CONSUMED')).toBe(true);
    expect(log.some((e) => e.action === 'K_ANON_OK')).toBe(true);
  });
});
