import { describe, it, expect, beforeEach } from 'vitest';
import { PublicHousingAssignmentAI } from '../public-housing-assignment-ai';

describe('PublicHousingAssignmentAI', () => {
  let ai: PublicHousingAssignmentAI;

  beforeEach(() => {
    ai = new PublicHousingAssignmentAI();
    ai.registerUnit({ unitId: 'u1', type: 'studio', monthlyRent: 300_000, available: true });
    ai.registerUnit({ unitId: 'u2', type: 'one_bed', monthlyRent: 500_000, available: true });
    ai.registerUnit({ unitId: 'u3', type: 'two_bed', monthlyRent: 700_000, available: true });
    ai.registerUnit({ unitId: 'u4', type: 'three_bed', monthlyRent: 900_000, available: true });
  });

  it('지원자 및 유닛 등록', () => {
    ai.registerApplicant({
      applicantId: 'a1',
      familySize: 2,
      monthlyIncome: 3_000_000,
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 6,
    });
    expect(ai.getAuditLog().filter(l => l.action === 'REGISTER_APPLICANT').length).toBe(1);
  });

  it('가족 수에 맞는 유닛 타입 매칭', () => {
    ai.registerApplicant({
      applicantId: 'a1',
      familySize: 2,
      monthlyIncome: 3_000_000,
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 6,
    });
    const results = ai.runAssignment();
    expect(results[0]!.unitId).toBe('u2'); // one_bed
  });

  it('장애가구는 우선순위 가산', () => {
    ai.registerApplicant({
      applicantId: 'normal',
      familySize: 1,
      monthlyIncome: 3_000_000,
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 6,
    });
    ai.registerApplicant({
      applicantId: 'disabled',
      familySize: 1,
      monthlyIncome: 3_000_000,
      hasDisability: true,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 6,
    });
    const results = ai.runAssignment();
    expect(results[0]!.applicantId).toBe('disabled');
  });

  it('소득 30% 초과 월세는 배정 제외', () => {
    ai.registerApplicant({
      applicantId: 'low',
      familySize: 4,
      monthlyIncome: 1_000_000, // 30% = 30만원 < 90만원 rent
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 6,
    });
    const results = ai.runAssignment();
    expect(results.length).toBe(0);
  });

  it('대기 기간이 길수록 우선순위 높음', () => {
    ai.registerApplicant({
      applicantId: 'short',
      familySize: 1,
      monthlyIncome: 3_000_000,
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 1,
    });
    ai.registerApplicant({
      applicantId: 'long',
      familySize: 1,
      monthlyIncome: 3_000_000,
      hasDisability: false,
      isElderly: false,
      hasMinorChildren: false,
      waitingMonths: 48,
    });
    const results = ai.runAssignment();
    expect(results[0]!.applicantId).toBe('long');
  });

  it('C등급 차단', () => {
    expect(() => ai.runAssignment('C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
