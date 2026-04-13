import { describe, it, expect, beforeEach } from 'vitest';
import { AlcoholLicenseRiskAI } from '../alcohol-license-risk-ai';

describe('AlcoholLicenseRiskAI', () => {
  let ai: AlcoholLicenseRiskAI;

  beforeEach(() => {
    ai = new AlcoholLicenseRiskAI();
  });

  it('신청서를 접수한다', () => {
    ai.submit({
      applicationId: 'a1',
      businessName: '테스트주점',
      licenseType: 'retail',
      operatingYears: 5,
      priorViolations: 0,
      locationNearSchoolMeters: 500,
      taxOverduesKRW: 0,
    });
    expect(ai.count()).toBe(1);
  });

  it('낮은 리스크를 승인한다', () => {
    ai.submit({
      applicationId: 'a1',
      businessName: 'A',
      licenseType: 'retail',
      operatingYears: 10,
      priorViolations: 0,
      locationNearSchoolMeters: 500,
      taxOverduesKRW: 0,
    });
    expect(ai.assess('a1').decision).toBe('approve');
  });

  it('학교 인근을 거부한다', () => {
    ai.submit({
      applicationId: 'a1',
      businessName: 'B',
      licenseType: 'retail',
      operatingYears: 5,
      priorViolations: 1,
      locationNearSchoolMeters: 30,
      taxOverduesKRW: 0,
    });
    const r = ai.assess('a1');
    expect(r.decision).toBe('reject');
    expect(r.reasons).toContain('TOO_CLOSE_TO_SCHOOL');
  });

  it('반복 위반자를 고위험으로 분류한다', () => {
    ai.submit({
      applicationId: 'a1',
      businessName: 'C',
      licenseType: 'wholesale',
      operatingYears: 5,
      priorViolations: 5,
      locationNearSchoolMeters: 500,
      taxOverduesKRW: 0,
    });
    expect(ai.assess('a1').reasons).toContain('REPEAT_VIOLATOR');
  });

  it('승인 목록을 조회한다', () => {
    ai.submit({
      applicationId: 'a1',
      businessName: 'D',
      licenseType: 'retail',
      operatingYears: 5,
      priorViolations: 0,
      locationNearSchoolMeters: 500,
      taxOverduesKRW: 0,
    });
    expect(ai.listByDecision('approve')).toContain('a1');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.submit(
        {
          applicationId: 'a1',
          businessName: 'X',
          licenseType: 'retail',
          operatingYears: 1,
          priorViolations: 0,
          locationNearSchoolMeters: 100,
          taxOverduesKRW: 0,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
