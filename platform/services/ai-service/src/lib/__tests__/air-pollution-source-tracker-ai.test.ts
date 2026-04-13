import { describe, it, expect, beforeEach } from 'vitest';
import { AirPollutionSourceTrackerAI } from '../air-pollution-source-tracker-ai';

describe('AirPollutionSourceTrackerAI', () => {
  let ai: AirPollutionSourceTrackerAI;

  beforeEach(() => {
    ai = new AirPollutionSourceTrackerAI();
    ai.registerSource({
      sourceId: 'factory1',
      lat: 37.60,
      lng: 127.00,
      type: 'factory',
      emissionIntensity: 80,
    });
    ai.registerSource({
      sourceId: 'road1',
      lat: 37.55,
      lng: 126.99,
      type: 'vehicle',
      emissionIntensity: 50,
    });
  });

  it('소스 등록', () => {
    expect(ai.getAuditLog().filter(l => l.action === 'REGISTER_SOURCE').length).toBe(2);
  });

  it('임계값 초과 판정', () => {
    const r = {
      sensorId: 's1',
      lat: 37.55,
      lng: 127.00,
      pollutant: 'pm25' as const,
      value: 50,
      timestamp: '2026-04-13T09:00:00Z',
      windDeg: 0,
      windSpeedMs: 3,
    };
    expect(ai.isPolluted(r)).toBe(true);
  });

  it('기여도 계산 및 정렬', () => {
    const res = ai.attribute({
      sensorId: 's1',
      lat: 37.55,
      lng: 127.00,
      pollutant: 'pm25' as const,
      value: 60,
      timestamp: '2026-04-13T09:00:00Z',
      windDeg: 0,
      windSpeedMs: 3,
    });
    expect(res.suspectedSources.length).toBeGreaterThan(0);
    for (let i = 1; i < res.suspectedSources.length; i++) {
      expect(res.suspectedSources[i - 1]!.contribution).toBeGreaterThanOrEqual(res.suspectedSources[i]!.contribution);
    }
  });

  it('50km 이상은 제외', () => {
    ai.registerSource({ sourceId: 'far', lat: 38.5, lng: 128.0, type: 'wildfire', emissionIntensity: 100 });
    const res = ai.attribute({
      sensorId: 's1',
      lat: 37.55,
      lng: 127.00,
      pollutant: 'pm10' as const,
      value: 100,
      timestamp: '2026-04-13T09:00:00Z',
      windDeg: 45,
      windSpeedMs: 3,
    });
    expect(res.suspectedSources.find(s => s.sourceId === 'far')).toBeUndefined();
  });

  it('음수 측정값 거부', () => {
    expect(() =>
      ai.attribute({
        sensorId: 's1',
        lat: 37.55,
        lng: 127.00,
        pollutant: 'pm25' as const,
        value: -1,
        timestamp: '2026-04-13T09:00:00Z',
        windDeg: 0,
        windSpeedMs: 3,
      }),
    ).toThrow(/음수/);
  });

  it('S등급 차단', () => {
    expect(() =>
      ai.attribute(
        {
          sensorId: 's1',
          lat: 37.55,
          lng: 127.00,
          pollutant: 'pm25',
          value: 60,
          timestamp: '2026-04-13T09:00:00Z',
          windDeg: 0,
          windSpeedMs: 3,
        },
        'S' as unknown as never,
      ),
    ).toThrow(/BLOCKED/);
  });
});
