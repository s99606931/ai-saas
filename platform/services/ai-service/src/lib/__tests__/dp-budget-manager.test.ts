import { describe, it, expect, beforeEach } from 'vitest';
import { DpBudgetManager } from '../dp-budget-manager';

describe('DpBudgetManager (MTU-N460)', () => {
  let svc: DpBudgetManager;

  beforeEach(() => {
    svc = new DpBudgetManager();
    svc.setBudget('ds1', 1.0, 1e-5);
  });

  it('FR-DP.1 Laplace noise 적용', () => {
    const noisy = svc.applyLaplace('ds1', 'q1', 100, 1, 0.1);
    expect(typeof noisy).toBe('number');
    expect(svc.getBudget('ds1')?.consumedEpsilon).toBeCloseTo(0.1, 3);
  });

  it('FR-DP.2 Gaussian noise 적용', () => {
    const noisy = svc.applyGaussian('ds1', 'q2', 100, 1, 0.1, 1e-6);
    expect(typeof noisy).toBe('number');
    expect(svc.getBudget('ds1')?.consumedDelta).toBeGreaterThan(0);
  });

  it('FR-DP.3 예산 추적 및 초과 차단', () => {
    svc.applyLaplace('ds1', 'q3', 10, 1, 0.5);
    svc.applyLaplace('ds1', 'q4', 10, 1, 0.4);
    expect(() => svc.applyLaplace('ds1', 'q5', 10, 1, 0.2)).toThrow(/ε 예산 초과/);
  });

  it('FR-DP.4 쿼리 감사 로그', () => {
    svc.applyLaplace('ds1', 'q6', 50, 1, 0.1);
    const log = svc.getAudit();
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0]!.mechanism).toBe('laplace');
  });

  it('FR-DP.5 합성 데이터 생성', () => {
    const records = [{ age: 30, income: 50000 }, { age: 40, income: 70000 }];
    const synth = svc.generateSynthetic(records, 1, 0.5);
    expect(synth.length).toBe(2);
    expect(Object.keys(synth[0]!)).toEqual(['age', 'income']);
  });
});
