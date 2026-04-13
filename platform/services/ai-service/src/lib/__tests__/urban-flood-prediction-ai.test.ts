import { describe, it, expect, beforeEach } from 'vitest';
import { UrbanFloodPredictionAI } from '../urban-flood-prediction-ai';

describe('UrbanFloodPredictionAI', () => {
  let ai: UrbanFloodPredictionAI;

  beforeEach(() => {
    ai = new UrbanFloodPredictionAI();
  });

  it('지역 프로필을 등록한다', () => {
    ai.registerDistrict({
      districtId: 'd1',
      name: '강남',
      drainageCapacityMmPerHour: 50,
      elevationM: 25,
      impermeableAreaRatio: 0.7,
    });
    expect(ai.listDistricts().length).toBe(1);
  });

  it('강수 관측을 기록한다', () => {
    ai.registerDistrict({
      districtId: 'd1',
      name: 'A',
      drainageCapacityMmPerHour: 40,
      elevationM: 20,
      impermeableAreaRatio: 0.5,
    });
    ai.recordRainfall({ districtId: 'd1', observedAt: '2026-04-13T14:00:00Z', rainfallMmPerHour: 30, durationHours: 2 });
    expect(ai.getObservations('d1').length).toBe(1);
  });

  it('정상 범위 강수는 안전으로 예측한다', () => {
    ai.registerDistrict({
      districtId: 'd1',
      name: 'A',
      drainageCapacityMmPerHour: 80,
      elevationM: 50,
      impermeableAreaRatio: 0.3,
    });
    ai.recordRainfall({ districtId: 'd1', observedAt: 'now', rainfallMmPerHour: 10, durationHours: 1 });
    const result = ai.predict('d1');
    expect(result.level).toBe('safe');
    expect(result.evacuationAdvised).toBe(false);
  });

  it('폭우 시 대피 권고를 발령한다', () => {
    ai.registerDistrict({
      districtId: 'd1',
      name: 'B',
      drainageCapacityMmPerHour: 20,
      elevationM: 5,
      impermeableAreaRatio: 0.9,
    });
    ai.recordRainfall({ districtId: 'd1', observedAt: 'now', rainfallMmPerHour: 80, durationHours: 2 });
    const result = ai.predict('d1');
    expect(result.evacuationAdvised).toBe(true);
    expect(['severe', 'catastrophic']).toContain(result.level);
  });

  it('강수 관측 없이 예측을 거부한다', () => {
    ai.registerDistrict({
      districtId: 'd1',
      name: 'C',
      drainageCapacityMmPerHour: 50,
      elevationM: 10,
      impermeableAreaRatio: 0.5,
    });
    expect(() => ai.predict('d1')).toThrow('강수 관측 없음');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerDistrict(
        {
          districtId: 'd1',
          name: 'X',
          drainageCapacityMmPerHour: 30,
          elevationM: 10,
          impermeableAreaRatio: 0.4,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
