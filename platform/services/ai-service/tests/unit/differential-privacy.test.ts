// SVC-AI-ADV-R35 단위 테스트: 차등 프라이버시 엔진
// Design Ref: SVC-AI-ADV-R35 DESIGN §4
// Plan SC: FR-ADV35.4 (데이터 추론 방지)
// CSAP: D-09 데이터 보호, N2SF C등급 데이터 AI 활용 보장

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  DifferentialPrivacy,
  getDifferentialPrivacy,
  resetDifferentialPrivacy,
} from '../../src/lib/differential-privacy.js';

// -- 그래디언트 클리핑 -----------------------------------------------------------

describe('DifferentialPrivacy 그래디언트 클리핑', () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({ maxGradNorm: 1.0 });
  });

  it('L2 norm 이내면 원본 유지', () => {
    const gradients = [0.3, 0.4]; // L2 = 0.5
    const clipped = dp.clipGradients(gradients);
    expect(clipped).toEqual(gradients);
  });

  it('L2 norm 초과 시 클리핑', () => {
    const gradients = [3.0, 4.0]; // L2 = 5.0
    const clipped = dp.clipGradients(gradients);
    const l2 = Math.sqrt(clipped.reduce((s, g) => s + g * g, 0));
    expect(l2).toBeCloseTo(1.0, 4);
  });

  it('방향을 보존한다', () => {
    const gradients = [6.0, 8.0]; // L2 = 10
    const clipped = dp.clipGradients(gradients);
    // 비율 보존: 6:8 = 0.6:0.8
    expect(clipped[0]! / clipped[1]!).toBeCloseTo(6 / 8, 4);
  });

  it('빈 그래디언트 처리', () => {
    expect(dp.clipGradients([])).toEqual([]);
  });
});

// -- 노이즈 생성 ---------------------------------------------------------------

describe('DifferentialPrivacy 노이즈 생성', () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({ noiseMultiplier: 1.0, maxGradNorm: 1.0 });
  });

  it('지정 차원의 노이즈를 생성한다', () => {
    const noise = dp.generateNoise(10);
    expect(noise).toHaveLength(10);
  });

  it('노이즈가 0이 아니다', () => {
    const noise = dp.generateNoise(100);
    // 100개 노이즈 중 하나라도 0이 아니면 통과
    expect(noise.some((n) => n !== 0)).toBe(true);
  });
});

// -- DP 그래디언트 적용 ---------------------------------------------------------

describe('DifferentialPrivacy 그래디언트 DP 적용', () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({
      maxGradNorm: 1.0,
      noiseMultiplier: 1.0,
      maxQueries: 100,
    });
  });

  it('노이즈가 추가된 그래디언트를 반환한다', () => {
    const gradients = [0.5, 0.5];
    const noisy = dp.addNoiseToGradients(gradients);
    expect(noisy).toHaveLength(2);
    // 노이즈가 추가되었으므로 원본과 다를 가능성이 높음
    const diff = Math.abs(noisy[0]! - gradients[0]!) + Math.abs(noisy[1]! - gradients[1]!);
    // 통계적으로 0일 확률은 극히 낮음 (수학적으로 확률 0)
    expect(diff).toBeGreaterThan(0);
  });

  it('예산을 소비한다', () => {
    dp.addNoiseToGradients([1.0]);
    const budget = dp.getBudget();
    expect(budget.queryCount).toBe(1);
    expect(budget.usedEpsilon).toBeGreaterThan(0);
  });
});

// -- 스칼라 DP ----------------------------------------------------------------

describe('DifferentialPrivacy 스칼라 DP', () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({ epsilon: 1.0, maxQueries: 100 });
  });

  it('라플라스 노이즈를 추가한다', () => {
    const result = dp.addLaplaceNoise(100, 1);
    expect(result.value).not.toBe(100); // 노이즈가 정확히 0일 확률은 0
    expect(result.noiseAdded).not.toBe(0);
    expect(result.epsilonUsed).toBeGreaterThan(0);
  });

  it('가우시안 노이즈를 추가한다', () => {
    const result = dp.addGaussianNoise(100, 1);
    expect(result.value).not.toBe(100);
    expect(result.epsilonUsed).toBeGreaterThan(0);
  });

  it('예산 소진 후 노이즈 없이 원본 반환', () => {
    const dp = new DifferentialPrivacy({ epsilon: 0.001, maxQueries: 1 });
    dp.addLaplaceNoise(50, 1); // 예산 소진
    const result = dp.addLaplaceNoise(100, 1);
    expect(result.value).toBe(100);
    expect(result.noiseAdded).toBe(0);
  });
});

// -- 집계 DP ------------------------------------------------------------------

describe('DifferentialPrivacy 집계 DP', () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({ epsilon: 1.0, maxQueries: 100 });
  });

  it('DP 합계를 계산한다', () => {
    const values = [10, 20, 30, 40, 50];
    const result = dp.privateSum(values, 50);
    // 실제 합 = 150, 노이즈 포함
    expect(result.value).toBeDefined();
    expect(result.epsilonUsed).toBeGreaterThan(0);
  });

  it('DP 평균을 계산한다', () => {
    const values = [100, 100, 100, 100, 100];
    const result = dp.privateMean(values, 10);
    // 실제 평균 = 100, 노이즈 포함
    expect(result.value).toBeDefined();
  });

  it('빈 배열의 DP 평균은 0', () => {
    const result = dp.privateMean([], 1);
    expect(result.value).toBe(0);
    expect(result.noiseAdded).toBe(0);
  });

  it('DP 카운트를 계산한다', () => {
    const predicate = [true, true, false, true, false];
    const result = dp.privateCount(predicate);
    // 실제 카운트 = 3, 노이즈 포함
    expect(result.value).toBeDefined();
    expect(result.epsilonUsed).toBeGreaterThan(0);
  });
});

// -- 예산 관리 ----------------------------------------------------------------

describe('DifferentialPrivacy 예산 관리', () => {
  it('초기 예산 상태', () => {
    const dp = new DifferentialPrivacy({ epsilon: 2.0, maxQueries: 100 });
    const budget = dp.getBudget();
    expect(budget.totalEpsilon).toBe(2.0);
    expect(budget.usedEpsilon).toBe(0);
    expect(budget.remainingEpsilon).toBe(2.0);
    expect(budget.queryCount).toBe(0);
    expect(budget.isExhausted).toBe(false);
  });

  it('쿼리 수 초과로 예산 소진', () => {
    const dp = new DifferentialPrivacy({ maxQueries: 3, epsilon: 100 });
    dp.addLaplaceNoise(1, 1);
    dp.addLaplaceNoise(1, 1);
    dp.addLaplaceNoise(1, 1);
    expect(dp.isExhausted()).toBe(true);
  });

  it('예산 초기화', () => {
    const dp = new DifferentialPrivacy({ maxQueries: 3, epsilon: 100 });
    dp.addLaplaceNoise(1, 1);
    dp.addLaplaceNoise(1, 1);
    dp.resetBudget();
    expect(dp.getBudget().queryCount).toBe(0);
    expect(dp.getBudget().usedEpsilon).toBe(0);
    expect(dp.isExhausted()).toBe(false);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('DifferentialPrivacy 팩토리', () => {
  afterEach(() => {
    resetDifferentialPrivacy();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const d1 = getDifferentialPrivacy();
    const d2 = getDifferentialPrivacy();
    expect(d1).toBe(d2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const d1 = getDifferentialPrivacy();
    resetDifferentialPrivacy();
    const d2 = getDifferentialPrivacy();
    expect(d1).not.toBe(d2);
  });
});
