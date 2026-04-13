import { describe, it, expect, beforeEach } from 'vitest';
import { PublicPensionFundOptimizerAI } from '../public-pension-fund-optimizer-ai';

describe('PublicPensionFundOptimizerAI', () => {
  let ai: PublicPensionFundOptimizerAI;

  const returns = [
    { assetClass: 'domestic_equity' as const, expectedReturn: 0.08, volatility: 0.18, currentWeight: 0.20 },
    { assetClass: 'foreign_equity' as const, expectedReturn: 0.09, volatility: 0.20, currentWeight: 0.15 },
    { assetClass: 'domestic_bond' as const, expectedReturn: 0.04, volatility: 0.06, currentWeight: 0.30 },
    { assetClass: 'foreign_bond' as const, expectedReturn: 0.05, volatility: 0.08, currentWeight: 0.15 },
    { assetClass: 'alternative' as const, expectedReturn: 0.07, volatility: 0.15, currentWeight: 0.15 },
    { assetClass: 'cash' as const, expectedReturn: 0.02, volatility: 0.01, currentWeight: 0.05 },
  ];

  beforeEach(() => {
    ai = new PublicPensionFundOptimizerAI();
  });

  it('수익률 데이터를 검증한다', () => {
    ai.validateReturns(returns);
    expect(ai.getAuditLog().some(l => l.action === 'VALIDATE_RETURNS')).toBe(true);
  });

  it('가중치 합계 불일치를 탐지한다', () => {
    const bad = returns.map((r, i) => i === 0 ? { ...r, currentWeight: 0.50 } : r);
    expect(() => ai.validateReturns(bad)).toThrow(/가중치 합계/);
  });

  it('moderate 위험 프로파일 최적화', () => {
    const res = ai.optimize('p1', returns, 'moderate');
    expect(res.targetAllocation.length).toBe(6);
    expect(res.expectedAnnualReturn).toBeGreaterThan(0);
    expect(res.sharpeRatio).toBeGreaterThan(0);
  });

  it('aggressive는 주식 비중이 더 높다', () => {
    const agg = ai.optimize('p2', returns, 'aggressive');
    const cons = ai.optimize('p3', returns, 'conservative');
    const aggEq = agg.targetAllocation.find(a => a.assetClass === 'domestic_equity')!.weight;
    const consEq = cons.targetAllocation.find(a => a.assetClass === 'domestic_equity')!.weight;
    expect(aggEq).toBeGreaterThan(consEq);
  });

  it('결과를 조회한다', () => {
    ai.optimize('p1', returns, 'moderate');
    expect(ai.getResult('p1')).toBeDefined();
  });

  it('C등급을 차단한다', () => {
    expect(() => ai.optimize('p1', returns, 'moderate', 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
