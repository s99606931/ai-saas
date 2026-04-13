import { describe, it, expect, beforeEach } from 'vitest';
import { PublicRentalHousingAI } from '../public-rental-housing-ai';

describe('PublicRentalHousingAI', () => {
  let ai: PublicRentalHousingAI;

  beforeEach(() => {
    ai = new PublicRentalHousingAI();
  });

  it('신청자를 등록하고 자격을 평가한다', () => {
    ai.registerApplicant({
      applicantId: 'A1',
      householdType: 'senior',
      householdSize: 1,
      monthlyIncomeKRW: 1_500_000,
      assetKRW: 50_000_000,
      hasHousing: false,
      disabilityGrade: 0,
      yearsInRegion: 10,
    });
    const result = ai.evaluateEligibility('A1');
    expect(result.eligible).toBe(true);
    expect(result.priorityScore).toBeGreaterThanOrEqual(55);
  });

  it('기존 주택 보유자는 비자격이다', () => {
    ai.registerApplicant({
      applicantId: 'A2',
      householdType: 'family',
      householdSize: 3,
      monthlyIncomeKRW: 2_000_000,
      assetKRW: 100_000_000,
      hasHousing: true,
      disabilityGrade: 0,
      yearsInRegion: 3,
    });
    const result = ai.evaluateEligibility('A2');
    expect(result.eligible).toBe(false);
  });

  it('소득 초과는 비자격이다', () => {
    ai.registerApplicant({
      applicantId: 'A3',
      householdType: 'family',
      householdSize: 2,
      monthlyIncomeKRW: 6_000_000,
      assetKRW: 100_000_000,
      hasHousing: false,
      disabilityGrade: 0,
      yearsInRegion: 3,
    });
    const result = ai.evaluateEligibility('A3');
    expect(result.eligible).toBe(false);
  });

  it('임대 유닛을 배정한다', () => {
    ai.registerApplicant({
      applicantId: 'A4',
      householdType: 'newlywed',
      householdSize: 2,
      monthlyIncomeKRW: 3_000_000,
      assetKRW: 80_000_000,
      hasHousing: false,
      disabilityGrade: 0,
      yearsInRegion: 1,
    });
    ai.registerUnit({
      unitId: 'U1',
      type: 'newlywed',
      rentKRW: 400_000,
      depositKRW: 20_000_000,
      areaM2: 40,
      available: true,
    });
    const unitId = ai.allocateUnit('A4');
    expect(unitId).toBe('U1');
    expect(ai.listAvailableUnits().length).toBe(0);
  });

  it('감사 로그를 기록한다', () => {
    ai.registerApplicant({
      applicantId: 'A5',
      householdType: 'single',
      householdSize: 1,
      monthlyIncomeKRW: 1_000_000,
      assetKRW: 10_000_000,
      hasHousing: false,
      disabilityGrade: 0,
      yearsInRegion: 2,
    });
    ai.evaluateEligibility('A5');
    expect(ai.getAuditLog().some(l => l.action === 'EVALUATE_ELIGIBILITY')).toBe(true);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerApplicant(
        {
          applicantId: 'X',
          householdType: 'family',
          householdSize: 2,
          monthlyIncomeKRW: 1,
          assetKRW: 1,
          hasHousing: false,
          disabilityGrade: 0,
          yearsInRegion: 0,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
