import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicToiletAccessibility } from '../ai-public-toilet-accessibility';

describe('AIPublicToiletAccessibility', () => {
  let ai: AIPublicToiletAccessibility;

  beforeEach(() => {
    ai = new AIPublicToiletAccessibility();
  });

  it('화장실을 등록한다', () => {
    ai.registerFacility({
      toiletId: 't1',
      location: '시청',
      hasWheelchairAccess: true,
      hasBabyChangingTable: true,
      hasChildToilet: true,
      hasEmergencyButton: true,
      hasNonSlipFloor: true,
      cleanlinessScore: 9,
    });
    expect(ai.getFacility('t1')?.cleanlinessScore).toBe(9);
  });

  it('A등급을 산정한다', () => {
    ai.registerFacility({
      toiletId: 't1',
      location: '시청',
      hasWheelchairAccess: true,
      hasBabyChangingTable: true,
      hasChildToilet: true,
      hasEmergencyButton: true,
      hasNonSlipFloor: true,
      cleanlinessScore: 10,
    });
    const r = ai.evaluate('t1');
    expect(r.grade).toBe('A');
    expect(r.totalScore).toBeGreaterThanOrEqual(85);
  });

  it('D등급은 누락 기능을 나열한다', () => {
    ai.registerFacility({
      toiletId: 't1',
      location: '공원',
      hasWheelchairAccess: false,
      hasBabyChangingTable: false,
      hasChildToilet: false,
      hasEmergencyButton: false,
      hasNonSlipFloor: false,
      cleanlinessScore: 3,
    });
    const r = ai.evaluate('t1');
    expect(r.grade).toBe('D');
    expect(r.missingFeatures.length).toBeGreaterThan(3);
  });

  it('등급별 목록을 필터링한다', () => {
    ai.registerFacility({
      toiletId: 'ta',
      location: 'A',
      hasWheelchairAccess: true,
      hasBabyChangingTable: true,
      hasChildToilet: true,
      hasEmergencyButton: true,
      hasNonSlipFloor: true,
      cleanlinessScore: 10,
    });
    expect(ai.listByGrade('A').length).toBe(1);
  });

  it('휠체어 접근 가능 화장실을 집계한다', () => {
    ai.registerFacility({
      toiletId: 't1',
      location: 'A',
      hasWheelchairAccess: true,
      hasBabyChangingTable: false,
      hasChildToilet: false,
      hasEmergencyButton: false,
      hasNonSlipFloor: false,
      cleanlinessScore: 5,
    });
    ai.registerFacility({
      toiletId: 't2',
      location: 'B',
      hasWheelchairAccess: false,
      hasBabyChangingTable: false,
      hasChildToilet: false,
      hasEmergencyButton: false,
      hasNonSlipFloor: false,
      cleanlinessScore: 5,
    });
    expect(ai.wheelchairAccessibleCount()).toBe(1);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerFacility(
        {
          toiletId: 't',
          location: 'X',
          hasWheelchairAccess: false,
          hasBabyChangingTable: false,
          hasChildToilet: false,
          hasEmergencyButton: false,
          hasNonSlipFloor: false,
          cleanlinessScore: 5,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
