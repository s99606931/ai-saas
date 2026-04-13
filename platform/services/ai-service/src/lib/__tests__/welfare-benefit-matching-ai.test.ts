import { describe, it, expect, beforeEach } from 'vitest';
import { WelfareBenefitMatchingAI } from '../welfare-benefit-matching-ai';

describe('WelfareBenefitMatchingAI', () => {
  let ai: WelfareBenefitMatchingAI;

  beforeEach(() => {
    ai = new WelfareBenefitMatchingAI();
    ai.registerProgram({
      programId: 'P-BASIC',
      name: '기초생활수급',
      maxIncomeKRW: 1_500_000,
      maxAssetKRW: 50_000_000,
      monthlyAmountKRW: 600_000,
    });
    ai.registerProgram({
      programId: 'P-ELDERLY',
      name: '노인 기초연금',
      maxIncomeKRW: 2_000_000,
      maxAssetKRW: 100_000_000,
      requiresElderly: true,
      monthlyAmountKRW: 300_000,
    });
    ai.registerProgram({
      programId: 'P-CHILD',
      name: '아동수당',
      maxIncomeKRW: 5_000_000,
      maxAssetKRW: 300_000_000,
      requiresChildren: true,
      monthlyAmountKRW: 100_000,
    });
  });

  it('저소득 가구에 기초생활수급을 매칭한다', () => {
    ai.registerHousehold({
      householdId: 'H1',
      memberCount: 2,
      monthlyIncomeKRW: 1_000_000,
      assetKRW: 20_000_000,
      hasElderly: false,
      hasDisabled: false,
      hasChildren: false,
      isSingleParent: false,
      isUnemployed: true,
    });
    const matches = ai.matchBenefits('H1');
    const basic = matches.find(m => m.programId === 'P-BASIC');
    expect(basic?.eligible).toBe(true);
  });

  it('노인 가구에 기초연금을 매칭한다', () => {
    ai.registerHousehold({
      householdId: 'H2',
      memberCount: 1,
      monthlyIncomeKRW: 1_500_000,
      assetKRW: 50_000_000,
      hasElderly: true,
      hasDisabled: false,
      hasChildren: false,
      isSingleParent: false,
      isUnemployed: false,
    });
    const matches = ai.matchBenefits('H2');
    const elderly = matches.find(m => m.programId === 'P-ELDERLY');
    expect(elderly?.eligible).toBe(true);
  });

  it('아동 없는 가구는 아동수당 비자격이다', () => {
    ai.registerHousehold({
      householdId: 'H3',
      memberCount: 2,
      monthlyIncomeKRW: 3_000_000,
      assetKRW: 50_000_000,
      hasElderly: false,
      hasDisabled: false,
      hasChildren: false,
      isSingleParent: false,
      isUnemployed: false,
    });
    const matches = ai.matchBenefits('H3');
    const child = matches.find(m => m.programId === 'P-CHILD');
    expect(child?.eligible).toBe(false);
  });

  it('총 잠재 수급액을 계산한다', () => {
    ai.registerHousehold({
      householdId: 'H4',
      memberCount: 4,
      monthlyIncomeKRW: 1_200_000,
      assetKRW: 30_000_000,
      hasElderly: true,
      hasDisabled: false,
      hasChildren: true,
      isSingleParent: false,
      isUnemployed: true,
    });
    const total = ai.getTotalPotentialBenefit('H4');
    expect(total).toBe(600_000 + 300_000 + 100_000);
  });

  it('프로그램 목록을 반환한다', () => {
    expect(ai.listPrograms().length).toBe(3);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerHousehold(
        {
          householdId: 'X',
          memberCount: 1,
          monthlyIncomeKRW: 0,
          assetKRW: 0,
          hasElderly: false,
          hasDisabled: false,
          hasChildren: false,
          isSingleParent: false,
          isUnemployed: false,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
