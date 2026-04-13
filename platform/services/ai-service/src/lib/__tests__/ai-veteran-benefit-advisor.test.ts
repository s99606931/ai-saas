import { describe, it, expect, beforeEach } from 'vitest';
import {
  VeteranBenefitAdvisor,
  type VeteranProfile,
  type BenefitDefinition,
} from '../ai-veteran-benefit-advisor';

const sampleVeteran = (id: string, overrides: Partial<VeteranProfile> = {}): VeteranProfile => ({
  veteranId: id,
  category: 'service',
  serviceYears: 20,
  ageYears: 65,
  incomeLevel: 'low',
  ...overrides,
});

const sampleBenefit = (id: string, overrides: Partial<BenefitDefinition> = {}): BenefitDefinition => ({
  benefitId: id,
  name: '기본 보훈 수당',
  eligibleCategories: ['service', 'combat'],
  minServiceYears: 10,
  maxIncomeLevel: 'medium',
  monthlyAmountKRW: 500_000,
  ...overrides,
});

describe('VeteranBenefitAdvisor', () => {
  let ai: VeteranBenefitAdvisor;

  beforeEach(() => {
    ai = new VeteranBenefitAdvisor();
  });

  it('보훈대상자와 혜택을 등록한다', () => {
    ai.registerVeteran(sampleVeteran('v1'));
    ai.defineBenefit(sampleBenefit('b1'));
    expect(ai.listBenefits().length).toBe(1);
  });

  it('자격 매칭을 수행한다', () => {
    ai.registerVeteran(sampleVeteran('v1'));
    ai.defineBenefit(sampleBenefit('b1'));
    const result = ai.matchBenefits('v1');
    expect(result.eligibleBenefits).toContain('b1');
    expect(result.totalMonthlyKRW).toBe(500_000);
  });

  it('소득 수준이 높으면 혜택이 제외된다', () => {
    ai.registerVeteran(sampleVeteran('v1', { incomeLevel: 'high' }));
    ai.defineBenefit(sampleBenefit('b1', { maxIncomeLevel: 'low' }));
    const result = ai.matchBenefits('v1');
    expect(result.eligibleBenefits.length).toBe(0);
  });

  it('상이 등급 제한을 반영한다', () => {
    ai.registerVeteran(sampleVeteran('v1', { category: 'disabled', disabilityGrade: 3 }));
    ai.defineBenefit(sampleBenefit('b1', { eligibleCategories: ['disabled'], maxDisabilityGrade: 2 }));
    const result = ai.matchBenefits('v1');
    expect(result.eligibleBenefits.length).toBe(0);
  });

  it('카테고리별 통계를 반환한다', () => {
    ai.registerVeteran(sampleVeteran('v1', { category: 'combat' }));
    ai.registerVeteran(sampleVeteran('v2', { category: 'bereaved' }));
    const stats = ai.countByCategory();
    expect(stats.combat).toBe(1);
    expect(stats.bereaved).toBe(1);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.registerVeteran(sampleVeteran('v1'), 'C')).toThrow('BLOCKED');
  });
});
