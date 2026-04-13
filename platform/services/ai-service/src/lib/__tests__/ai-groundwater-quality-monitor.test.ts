import { describe, it, expect, beforeEach } from 'vitest';
import { AIGroundwaterQualityMonitor } from '../ai-groundwater-quality-monitor';

describe('AIGroundwaterQualityMonitor', () => {
  let ai: AIGroundwaterQualityMonitor;

  beforeEach(() => {
    ai = new AIGroundwaterQualityMonitor();
  });

  it('정상 범위 데이터는 경보 없음', () => {
    const alerts = ai.ingest({
      wellId: 'W1',
      timestamp: '2026-04-13T00:00:00Z',
      ph: 7.2,
      nitrate_mgL: 5,
      chloride_mgL: 100,
      tds_mgL: 300,
      temperatureC: 15,
    });
    expect(alerts).toHaveLength(0);
  });

  it('질산성질소 초과 시 경보 발생', () => {
    const alerts = ai.ingest({
      wellId: 'W2',
      timestamp: '2026-04-13T00:00:00Z',
      ph: 7,
      nitrate_mgL: 25,
      chloride_mgL: 50,
      tds_mgL: 200,
      temperatureC: 14,
    });
    expect(alerts.some((a) => a.parameter === 'nitrate')).toBe(true);
    expect(alerts.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('pH 하한 이탈 시 경보', () => {
    const alerts = ai.ingest({
      wellId: 'W3',
      timestamp: '2026-04-13T00:00:00Z',
      ph: 4.5,
      nitrate_mgL: 1,
      chloride_mgL: 10,
      tds_mgL: 100,
      temperatureC: 12,
    });
    expect(alerts.some((a) => a.parameter === 'ph')).toBe(true);
  });

  it('이동 평균을 계산한다', () => {
    for (let i = 0; i < 5; i++) {
      ai.ingest({
        wellId: 'W4',
        timestamp: `2026-04-0${i + 1}T00:00:00Z`,
        ph: 7 + i * 0.1,
        nitrate_mgL: 2,
        chloride_mgL: 10,
        tds_mgL: 150,
        temperatureC: 10,
      });
    }
    const avg = ai.movingAverage('W4', 'ph', 5);
    expect(avg).toBeGreaterThan(7);
    expect(avg).toBeLessThan(8);
  });

  it('임계값 오버라이드가 반영된다', () => {
    ai.setThreshold({ nitrateMax: 1 });
    const alerts = ai.ingest({
      wellId: 'W5',
      timestamp: '2026-04-13T00:00:00Z',
      ph: 7,
      nitrate_mgL: 2,
      chloride_mgL: 10,
      tds_mgL: 100,
      temperatureC: 15,
    });
    expect(alerts.some((a) => a.parameter === 'nitrate')).toBe(true);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.ingest(
        {
          wellId: 'W6',
          timestamp: '2026-04-13T00:00:00Z',
          ph: 7,
          nitrate_mgL: 5,
          chloride_mgL: 10,
          tds_mgL: 100,
          temperatureC: 10,
        },
        'S' as never,
      ),
    ).toThrow('BLOCKED');
  });
});
