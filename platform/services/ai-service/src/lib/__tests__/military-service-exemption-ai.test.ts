import { describe, it, expect, beforeEach } from 'vitest';
import { MilitaryServiceExemptionAI } from '../military-service-exemption-ai';

describe('MilitaryServiceExemptionAI', () => {
  let ai: MilitaryServiceExemptionAI;

  beforeEach(() => {
    ai = new MilitaryServiceExemptionAI();
  });

  it('신청서를 접수한다', () => {
    ai.submit({
      applicationId: 'a1',
      medicalGrade: 2,
      onlyMaleChildOfDisabledParent: false,
      familyDependentCount: 0,
      internationalAchievement: false,
      prosecuted: false,
    });
    expect(ai.get('a1')?.medicalGrade).toBe(2);
  });

  it('신체등급 5는 의료 면제로 분류한다', () => {
    ai.submit({
      applicationId: 'a1',
      medicalGrade: 5,
      onlyMaleChildOfDisabledParent: false,
      familyDependentCount: 0,
      internationalAchievement: false,
      prosecuted: false,
    });
    const r = ai.evaluate('a1');
    expect(r.category).toBe('medical');
    expect(r.eligible).toBe(true);
  });

  it('일반 신체등급은 면제 불가이다', () => {
    ai.submit({
      applicationId: 'a1',
      medicalGrade: 1,
      onlyMaleChildOfDisabledParent: false,
      familyDependentCount: 0,
      internationalAchievement: false,
      prosecuted: false,
    });
    expect(ai.evaluate('a1').eligible).toBe(false);
  });

  it('장애 부모 독자는 가족 부양 면제이다', () => {
    ai.submit({
      applicationId: 'a1',
      medicalGrade: 2,
      onlyMaleChildOfDisabledParent: true,
      familyDependentCount: 1,
      internationalAchievement: false,
      prosecuted: false,
    });
    expect(ai.evaluate('a1').category).toBe('family_support');
  });

  it('기소자는 면제 불가이다', () => {
    ai.submit({
      applicationId: 'a1',
      medicalGrade: 5,
      onlyMaleChildOfDisabledParent: true,
      familyDependentCount: 5,
      internationalAchievement: true,
      prosecuted: true,
    });
    const r = ai.evaluate('a1');
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain('PROSECUTED_DISQUALIFIED');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.submit(
        {
          applicationId: 'a1',
          medicalGrade: 2,
          onlyMaleChildOfDisabledParent: false,
          familyDependentCount: 0,
          internationalAchievement: false,
          prosecuted: false,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
