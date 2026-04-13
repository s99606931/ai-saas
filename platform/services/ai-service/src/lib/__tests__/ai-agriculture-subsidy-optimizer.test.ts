import { describe, it, expect, beforeEach } from 'vitest';
import { AgricultureSubsidyOptimizer, type FarmApplication } from '../ai-agriculture-subsidy-optimizer';

const sampleFarm = (id: string, overrides: Partial<FarmApplication> = {}): FarmApplication => ({
  farmId: id,
  cropType: 'rice',
  areaHa: 10,
  yearsOfOperation: 5,
  sustainabilityScore: 70,
  incomeLastYearKRW: 30_000_000,
  ...overrides,
});

describe('AgricultureSubsidyOptimizer', () => {
  let ai: AgricultureSubsidyOptimizer;

  beforeEach(() => {
    ai = new AgricultureSubsidyOptimizer();
  });

  it('신청을 접수한다', () => {
    ai.submit(sampleFarm('f1'));
    expect(ai.listApplications().length).toBe(1);
  });

  it('작물별 기본 보조금을 계산한다', () => {
    ai.submit(sampleFarm('f1', { cropType: 'rice', areaHa: 10 }));
    const alloc = ai.computeAllocation('f1');
    expect(alloc.baseGrantKRW).toBe(6_000_000);
  });

  it('지속가능성 가산을 반영한다', () => {
    ai.submit(sampleFarm('f1', { sustainabilityScore: 100 }));
    const alloc = ai.computeAllocation('f1');
    expect(alloc.sustainabilityBonusKRW).toBeGreaterThan(0);
  });

  it('저소득 농가 보전 수당을 지급한다', () => {
    ai.submit(sampleFarm('f1', { incomeLastYearKRW: 5_000_000 }));
    const alloc = ai.computeAllocation('f1');
    expect(alloc.incomeSupplementKRW).toBeGreaterThan(0);
  });

  it('예산 한도를 적용하여 배분한다', () => {
    ai.submit(sampleFarm('f1', { areaHa: 100 }));
    ai.submit(sampleFarm('f2', { areaHa: 100 }));
    const allocs = ai.optimizeBudget(1_000_000);
    const total = allocs.reduce((sum, a) => sum + a.totalKRW, 0);
    expect(total).toBeLessThanOrEqual(1_000_001);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.submit(sampleFarm('f1'), 'S')).toThrow('BLOCKED');
  });
});
