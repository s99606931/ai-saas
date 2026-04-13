import { describe, it, expect, beforeEach } from 'vitest';
import { SportsTalentDiscoveryAI } from '../sports-talent-discovery-ai';

describe('SportsTalentDiscoveryAI', () => {
  let ai: SportsTalentDiscoveryAI;

  beforeEach(() => {
    ai = new SportsTalentDiscoveryAI();
  });

  it('프로필을 등록한다', () => {
    ai.registerProfile({
      athleteCode: 'A1',
      ageYears: 15,
      heightCm: 175,
      weightKg: 65,
      verticalJumpCm: 50,
      sprint50mSec: 7.2,
      enduranceRunKm: 2.5,
      flexibilityCm: 20,
    });
    expect(ai.getProfileCount()).toBe(1);
  });

  it('신장과 점프가 좋은 경우 농구를 최상위로 추천한다', () => {
    ai.registerProfile({
      athleteCode: 'A2',
      ageYears: 16,
      heightCm: 190,
      weightKg: 80,
      verticalJumpCm: 70,
      sprint50mSec: 7.6,
      enduranceRunKm: 2.0,
      flexibilityCm: 15,
    });
    const top = ai.getTopRecommendation('A2');
    expect(top.sport).toBe('basketball');
    expect(top.fitScore).toBeGreaterThanOrEqual(70);
  });

  it('스프린트가 빠른 경우 육상을 상위로 추천한다', () => {
    ai.registerProfile({
      athleteCode: 'A3',
      ageYears: 14,
      heightCm: 170,
      weightKg: 60,
      verticalJumpCm: 45,
      sprint50mSec: 6.8,
      enduranceRunKm: 3.2,
      flexibilityCm: 18,
    });
    const fits = ai.analyzeFit('A3');
    const athletics = fits.find(f => f.sport === 'athletics');
    expect(athletics?.fitScore).toBeGreaterThanOrEqual(60);
  });

  it('연령 범위를 벗어난 프로필은 거부한다', () => {
    expect(() =>
      ai.registerProfile({
        athleteCode: 'A4',
        ageYears: 30,
        heightCm: 180,
        weightKg: 75,
        verticalJumpCm: 50,
        sprint50mSec: 7.5,
        enduranceRunKm: 2.5,
        flexibilityCm: 20,
      }),
    ).toThrow('연령');
  });

  it('인재풀을 종목별로 조회한다', () => {
    ai.registerProfile({
      athleteCode: 'A5',
      ageYears: 16,
      heightCm: 190,
      weightKg: 80,
      verticalJumpCm: 70,
      sprint50mSec: 7.6,
      enduranceRunKm: 2.0,
      flexibilityCm: 15,
    });
    ai.registerProfile({
      athleteCode: 'A6',
      ageYears: 15,
      heightCm: 160,
      weightKg: 50,
      verticalJumpCm: 30,
      sprint50mSec: 8.5,
      enduranceRunKm: 1.5,
      flexibilityCm: 10,
    });
    const pool = ai.listTalentPool('basketball', 60);
    expect(pool.includes('A5')).toBe(true);
    expect(pool.includes('A6')).toBe(false);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerProfile(
        {
          athleteCode: 'X',
          ageYears: 10,
          heightCm: 140,
          weightKg: 35,
          verticalJumpCm: 20,
          sprint50mSec: 9,
          enduranceRunKm: 1,
          flexibilityCm: 10,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
