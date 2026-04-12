/**
 * 차등 프라이버시 테스트
 * Plan SC: FR-DP.1~5
 */

import {
  PrivacyBudget,
  LaplaceMechanism,
  GaussianMechanism,
  DpQueryLogger,
  SyntheticDataGenerator,
} from '../src/differential-privacy';

describe('PrivacyBudget', () => {
  it('생성: 양수 예산 필수', () => {
    expect(() => new PrivacyBudget(0)).toThrow();
    expect(() => new PrivacyBudget(-1)).toThrow();
  });

  it('spend: 잔액 추적', () => {
    const b = new PrivacyBudget(1.0);
    b.spend(0.3);
    expect(b.usedAmount()).toBeCloseTo(0.3);
    expect(b.remaining()).toBeCloseTo(0.7);
  });

  it('spend: 음수 거부', () => {
    const b = new PrivacyBudget(1.0);
    expect(() => b.spend(-0.1)).toThrow(/양수/);
  });

  it('spend: 예산 초과 거부', () => {
    const b = new PrivacyBudget(1.0);
    b.spend(0.6);
    expect(() => b.spend(0.5)).toThrow(/예산 초과/);
  });
});

describe('LaplaceMechanism', () => {
  const lap = new LaplaceMechanism();

  it('count: 노이즈 추가 (실제값 ± 합리적 범위)', () => {
    const samples = Array.from({ length: 1000 }, () => lap.count(100, 1, 1));
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    // 기대값은 100, 큰 표본 평균은 ~100에 근접
    expect(Math.abs(avg - 100)).toBeLessThan(10);
  });

  it('sum: 노이즈 추가 동일 동작', () => {
    const result = lap.sum(500, 1, 0.5);
    expect(typeof result).toBe('number');
  });

  it('ε 작을수록 노이즈 큼 (분산 큼)', () => {
    const samplesHigh = Array.from({ length: 500 }, () => lap.count(100, 1, 0.01));
    const samplesLow = Array.from({ length: 500 }, () => lap.count(100, 1, 10));
    const varHigh = variance(samplesHigh);
    const varLow = variance(samplesLow);
    expect(varHigh).toBeGreaterThan(varLow);
  });
});

describe('GaussianMechanism', () => {
  const gauss = new GaussianMechanism();

  it('sigma 계산: NIST 공식', () => {
    const sigma = gauss.sigma(1, 1, 1e-5);
    expect(sigma).toBeGreaterThan(0);
  });

  it('noise 추가', () => {
    const n = gauss.noise(1, 1, 1e-5);
    expect(typeof n).toBe('number');
  });

  it('privatizeGradient: clipNorm 적용 + 노이즈 추가', () => {
    const grad = [1, 2, 3, 4, 5];
    const result = gauss.privatizeGradient(grad, 1, 1, 1e-5);
    expect(result.length).toBe(grad.length);
  });

  it('privatizeGradient: 빈 입력 안전', () => {
    const result = gauss.privatizeGradient([], 1, 1, 1e-5);
    expect(result).toEqual([]);
  });
});

describe('DpQueryLogger', () => {
  it('log + totalEpsilon 합산', () => {
    const logger = new DpQueryLogger();
    logger.log({
      queryId: 'q1',
      type: 'count',
      epsilon: 0.3,
      timestamp: '',
      actor: 'admin',
    });
    logger.log({
      queryId: 'q2',
      type: 'sum',
      epsilon: 0.5,
      timestamp: '',
      actor: 'admin',
    });
    expect(logger.all().length).toBe(2);
    expect(logger.totalEpsilon()).toBeCloseTo(0.8);
  });
});

describe('SyntheticDataGenerator', () => {
  it('히스토그램 기반 샘플링', () => {
    const gen = new SyntheticDataGenerator();
    const histogram = new Map<string, number>([
      ['A', 100],
      ['B', 50],
      ['C', 25],
    ]);
    const samples = gen.generate(histogram, 50, 1.0);
    expect(samples.length).toBe(50);
    samples.forEach((s) => expect(['A', 'B', 'C']).toContain(s));
  });

  it('빈 히스토그램 시 빈 배열', () => {
    const gen = new SyntheticDataGenerator();
    const samples = gen.generate(new Map(), 10, 1.0);
    expect(samples).toEqual([]);
  });
});

function variance(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}
