import { describe, it, expect, beforeEach } from 'vitest';
import { AIAirQualityForecaster } from '../ai-air-quality-forecaster';

describe('AIAirQualityForecaster', () => {
  let ai: AIAirQualityForecaster;

  beforeEach(() => {
    ai = new AIAirQualityForecaster();
  });

  it('측정값을 기록한다', () => {
    ai.recordReading({ stationId: 'st1', timestamp: '2026-04-13T00:00:00Z', pollutant: 'pm25', value: 20 });
    expect(ai.countReadings('st1')).toBe(1);
  });

  it('가중 이동평균으로 예보한다', () => {
    for (let i = 0; i < 5; i++) {
      ai.recordReading({
        stationId: 'st1',
        timestamp: `2026-04-13T0${i}:00:00Z`,
        pollutant: 'pm25',
        value: 20 + i * 5,
      });
    }
    const f = ai.forecast('st1', 'pm25');
    expect(f.forecastValue).toBeGreaterThan(20);
    expect(['good', 'moderate', 'unhealthy_sensitive']).toContain(f.aqiLevel);
  });

  it('hazardous 수준 감지로 경보한다', () => {
    ai.recordReading({ stationId: 'st2', timestamp: 't', pollutant: 'pm25', value: 200 });
    expect(ai.alertIfUnhealthy('st2', 'pm25')).toBe(true);
  });

  it('good 수준은 경보하지 않는다', () => {
    ai.recordReading({ stationId: 'st3', timestamp: 't', pollutant: 'pm25', value: 5 });
    expect(ai.alertIfUnhealthy('st3', 'pm25')).toBe(false);
  });

  it('최신 측정값을 반환한다', () => {
    ai.recordReading({ stationId: 'st1', timestamp: 't1', pollutant: 'pm10', value: 50 });
    ai.recordReading({ stationId: 'st1', timestamp: 't2', pollutant: 'pm10', value: 80 });
    expect(ai.latestReading('st1', 'pm10')?.value).toBe(80);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.recordReading(
        { stationId: 'st1', timestamp: 't', pollutant: 'pm25', value: 10 },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
