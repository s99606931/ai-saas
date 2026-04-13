import { describe, it, expect, beforeEach } from 'vitest';
import { AIDisabilityServiceMatcher } from '../ai-disability-service-matcher';

describe('AIDisabilityServiceMatcher', () => {
  let ai: AIDisabilityServiceMatcher;

  beforeEach(() => {
    ai = new AIDisabilityServiceMatcher();
    ai.registerApplicant({
      applicantId: 'A1',
      disabilityType: 'mobility',
      severity: 'severe',
      incomeLevel: 2,
      region: 'seoul',
      ageGroup: 'adult',
    });
    ai.registerService({
      serviceId: 'S1',
      name: '이동 보조 서비스',
      eligibleTypes: ['mobility'],
      minSeverity: 'moderate',
      maxIncomeLevel: 3,
      region: 'seoul',
      ageGroups: ['adult', 'senior'],
      capacity: 100,
    });
    ai.registerService({
      serviceId: 'S2',
      name: '시각 지원',
      eligibleTypes: ['visual'],
      minSeverity: 'mild',
      maxIncomeLevel: 5,
      region: 'seoul',
      ageGroups: ['adult'],
      capacity: 50,
    });
  });

  it('신청자와 서비스를 등록한다', () => {
    expect(ai.listServicesByRegion('seoul').length).toBe(2);
  });

  it('자격 조건에 맞는 서비스를 매칭한다', () => {
    const matches = ai.match('A1');
    expect(matches.length).toBe(1);
    expect(matches[0]!.serviceId).toBe('S1');
  });

  it('소득 기준 초과 시 제외한다', () => {
    ai.registerApplicant({
      applicantId: 'A2',
      disabilityType: 'mobility',
      severity: 'severe',
      incomeLevel: 5,
      region: 'seoul',
      ageGroup: 'adult',
    });
    const matches = ai.match('A2');
    expect(matches.find(m => m.serviceId === 'S1')).toBeUndefined();
  });

  it('장애 유형별 서비스 수를 집계한다', () => {
    expect(ai.countServicesByType('mobility')).toBe(1);
    expect(ai.countServicesByType('visual')).toBe(1);
    expect(ai.countServicesByType('hearing')).toBe(0);
  });

  it('저소득자에게 우선 점수를 부여한다', () => {
    const matches = ai.match('A1');
    expect(matches[0]!.reason).toContain('low-income-priority');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerApplicant(
        {
          applicantId: 'X',
          disabilityType: 'mental',
          severity: 'mild',
          incomeLevel: 1,
          region: 'r',
          ageGroup: 'adult',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
