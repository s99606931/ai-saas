import { describe, it, expect, beforeEach } from 'vitest';
import { YouthHousingMatchAI } from '../youth-housing-match-ai';

describe('YouthHousingMatchAI', () => {
  let ai: YouthHousingMatchAI;

  beforeEach(() => {
    ai = new YouthHousingMatchAI();
  });

  it('신청자를 등록한다', () => {
    ai.registerApplicant({
      applicantId: 'a1',
      age: 25,
      monthlyIncomeKRW: 2_500_000,
      budgetKRW: 600_000,
      preferredRegion: '서울-관악',
      preferredType: 'one_room',
      needsSubsidy: true,
    });
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_APPLICANT')).toBe(true);
  });

  it('주거를 등록한다', () => {
    ai.registerHousing({
      housingId: 'h1',
      type: 'one_room',
      region: '서울-관악',
      monthlyRentKRW: 500_000,
      areaM2: 25,
      subsidyEligible: true,
      available: true,
    });
    expect(ai.listHousings().length).toBe(1);
  });

  it('매칭 점수를 반환한다', () => {
    ai.registerApplicant({
      applicantId: 'a1',
      age: 27,
      monthlyIncomeKRW: 2_500_000,
      budgetKRW: 600_000,
      preferredRegion: '서울-관악',
      preferredType: 'one_room',
      needsSubsidy: true,
    });
    ai.registerHousing({
      housingId: 'h1',
      type: 'one_room',
      region: '서울-관악',
      monthlyRentKRW: 500_000,
      areaM2: 25,
      subsidyEligible: true,
      available: true,
    });
    const matches = ai.match('a1');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.score).toBeGreaterThanOrEqual(90);
  });

  it('이용 불가 주거는 매칭에서 제외한다', () => {
    ai.registerApplicant({
      applicantId: 'a1',
      age: 25,
      monthlyIncomeKRW: 3_000_000,
      budgetKRW: 700_000,
      preferredRegion: '부산',
      preferredType: 'officetel',
      needsSubsidy: false,
    });
    ai.registerHousing({
      housingId: 'h1',
      type: 'officetel',
      region: '부산',
      monthlyRentKRW: 600_000,
      areaM2: 30,
      subsidyEligible: false,
      available: true,
    });
    ai.markUnavailable('h1');
    expect(ai.match('a1').length).toBe(0);
  });

  it('연령 범위 밖 신청자는 거부한다', () => {
    expect(() =>
      ai.registerApplicant({
        applicantId: 'a1',
        age: 45,
        monthlyIncomeKRW: 1_000_000,
        budgetKRW: 300_000,
        preferredRegion: '대구',
        preferredType: 'share_house',
        needsSubsidy: true,
      }),
    ).toThrow('연령');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerApplicant(
        {
          applicantId: 'a1',
          age: 25,
          monthlyIncomeKRW: 1,
          budgetKRW: 1,
          preferredRegion: 'X',
          preferredType: 'one_room',
          needsSubsidy: false,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
