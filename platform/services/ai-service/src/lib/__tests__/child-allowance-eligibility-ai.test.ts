import { describe, it, expect, beforeEach } from 'vitest';
import { ChildAllowanceEligibilityAI } from '../child-allowance-eligibility-ai';

describe('ChildAllowanceEligibilityAI', () => {
  let ai: ChildAllowanceEligibilityAI;

  beforeEach(() => {
    ai = new ChildAllowanceEligibilityAI();
  });

  it('신청을 접수한다', () => {
    ai.apply({
      applicationId: 'a1',
      childAgeMonths: 36,
      householdIncomeKRW: 50_000_000,
      residentInKorea: true,
      siblingCount: 1,
    });
    expect(ai.listApplications().length).toBe(1);
  });

  it('자격을 승인한다', () => {
    ai.apply({
      applicationId: 'a1',
      childAgeMonths: 36,
      householdIncomeKRW: 50_000_000,
      residentInKorea: true,
      siblingCount: 1,
    });
    const r = ai.evaluate('a1');
    expect(r.eligible).toBe(true);
    expect(r.monthlyAllowanceKRW).toBe(100_000);
  });

  it('연령 초과를 거부한다', () => {
    ai.apply({
      applicationId: 'a1',
      childAgeMonths: 200,
      householdIncomeKRW: 10_000_000,
      residentInKorea: true,
      siblingCount: 0,
    });
    const r = ai.evaluate('a1');
    expect(r.eligible).toBe(false);
    expect(r.reasonCodes).toContain('AGE_EXCEEDED');
  });

  it('다자녀 가산금을 지급한다', () => {
    ai.apply({
      applicationId: 'a1',
      childAgeMonths: 24,
      householdIncomeKRW: 30_000_000,
      residentInKorea: true,
      siblingCount: 3,
    });
    const r = ai.evaluate('a1');
    expect(r.monthlyAllowanceKRW).toBe(130_000);
  });

  it('소득 상한을 조정한다', () => {
    ai.setIncomeCap(50_000_000);
    ai.apply({
      applicationId: 'a1',
      childAgeMonths: 12,
      householdIncomeKRW: 60_000_000,
      residentInKorea: true,
      siblingCount: 0,
    });
    const r = ai.evaluate('a1');
    expect(r.reasonCodes).toContain('INCOME_OVER_CAP');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.apply(
        {
          applicationId: 'a1',
          childAgeMonths: 12,
          householdIncomeKRW: 0,
          residentInKorea: true,
          siblingCount: 0,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
