import { describe, it, expect, beforeEach } from 'vitest';
import { LocalEconomyVitalityAI } from '../local-economy-vitality-ai';

describe('LocalEconomyVitalityAI', () => {
  let ai: LocalEconomyVitalityAI;

  beforeEach(() => {
    ai = new LocalEconomyVitalityAI();
  });

  it('지역 지표를 등록한다', () => {
    ai.registerRegion({
      regionId: 'seoul',
      name: '서울',
      employmentRate: 70,
      smallBusinessRevenueIndex: 110,
      populationNetChange: 500,
      consumerSentimentIndex: 105,
    });
    expect(ai.countRegions()).toBe(1);
  });

  it('활력도를 평가한다', () => {
    ai.registerRegion({
      regionId: 'busan',
      name: '부산',
      employmentRate: 80,
      smallBusinessRevenueIndex: 120,
      populationNetChange: 1000,
      consumerSentimentIndex: 130,
    });
    const r = ai.evaluate('busan');
    expect(r.vitalityScore).toBeGreaterThan(50);
    expect(['vibrant', 'stable']).toContain(r.rank);
  });

  it('위기 지역을 식별한다', () => {
    ai.registerRegion({
      regionId: 'x',
      name: '위기',
      employmentRate: 30,
      smallBusinessRevenueIndex: 40,
      populationNetChange: -2000,
      consumerSentimentIndex: 50,
    });
    const crit = ai.criticalRegions();
    expect(crit.length).toBe(1);
  });

  it('순위를 반환한다', () => {
    ai.registerRegion({
      regionId: 'a',
      name: 'A',
      employmentRate: 80,
      smallBusinessRevenueIndex: 130,
      populationNetChange: 500,
      consumerSentimentIndex: 120,
    });
    ai.registerRegion({
      regionId: 'b',
      name: 'B',
      employmentRate: 50,
      smallBusinessRevenueIndex: 80,
      populationNetChange: -500,
      consumerSentimentIndex: 90,
    });
    const rk = ai.ranking();
    expect(rk[0]?.regionId).toBe('a');
  });

  it('유효하지 않은 고용률은 거부한다', () => {
    expect(() =>
      ai.registerRegion({
        regionId: 'x',
        name: 'x',
        employmentRate: 150,
        smallBusinessRevenueIndex: 100,
        populationNetChange: 0,
        consumerSentimentIndex: 100,
      }),
    ).toThrow('고용률');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerRegion(
        {
          regionId: 'x',
          name: 'x',
          employmentRate: 70,
          smallBusinessRevenueIndex: 100,
          populationNetChange: 0,
          consumerSentimentIndex: 100,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
