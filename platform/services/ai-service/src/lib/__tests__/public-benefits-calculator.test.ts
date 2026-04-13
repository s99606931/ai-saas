import { describe, it, expect, beforeEach } from 'vitest';
import { PublicBenefitsCalculator } from '../public-benefits-calculator.js';

describe('SVC-AI-ADV-R396 PublicBenefitsCalculator', () => {
  let svc: PublicBenefitsCalculator;
  beforeEach(() => {
    svc = new PublicBenefitsCalculator();
    svc.registerProgram({
      id: 'senior-support',
      name: '어르신 지원금',
      incomeCap: 3000000,
      minAge: 65,
      baseAmount: 300000,
      perMemberBonus: 50000,
    });
  });

  it('FR-386.1: 자격 충족 + 지원금 계산', () => {
    const r = svc.evaluate('senior-support', {
      income: 2500000,
      age: 70,
      householdSize: 3,
    });
    expect(r.eligible).toBe(true);
    expect(r.amount).toBe(300000 + 50000 * 2);
  });

  it('FR-386.2: 소득 초과 불합격', () => {
    const r = svc.evaluate('senior-support', {
      income: 4000000,
      age: 70,
      householdSize: 1,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('INCOME_OVER_CAP');
    expect(r.amount).toBe(0);
  });

  it('FR-386.3: 연령 미달 불합격', () => {
    const r = svc.evaluate('senior-support', {
      income: 1000000,
      age: 60,
      householdSize: 2,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('AGE_UNDER_MIN');
  });

  it('FR-386.4: C등급 차단', () => {
    expect(() =>
      svc.evaluate('senior-support', { income: 1000000, age: 70, householdSize: 1 }, 'C'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-386.5: 감사 로그', () => {
    svc.evaluate('senior-support', { income: 1000000, age: 70, householdSize: 1 });
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2); // register + evaluate
  });

  it('존재하지 않는 프로그램', () => {
    expect(() => svc.evaluate('unknown', { income: 0, age: 70, householdSize: 1 })).toThrow(
      'PROGRAM_NOT_FOUND',
    );
  });
});
