import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentalMonitoringAI } from '../environmental-monitoring-ai';

describe('EnvironmentalMonitoringAI', () => {
  let ai: EnvironmentalMonitoringAI;

  beforeEach(() => {
    ai = new EnvironmentalMonitoringAI();
    ai.registerStation({
      stationId: 's1',
      name: '서울시청 측정소',
      region: 'seoul',
      installedAt: '2025-01-01',
    });
  });

  it('측정소를 등록한다', () => {
    expect(ai.listStations().length).toBe(1);
  });

  it('측정값을 수집한다', () => {
    ai.ingestMeasurement({
      stationId: 's1',
      kind: 'pm25',
      value: 40,
      unit: 'ug/m3',
      measuredAt: 't',
    });
    expect(ai.listMeasurements('s1').length).toBe(1);
  });

  it('PM2.5를 unhealthy로 평가한다', () => {
    ai.ingestMeasurement({
      stationId: 's1',
      kind: 'pm25',
      value: 50,
      unit: 'ug/m3',
      measuredAt: 't',
    });
    const result = ai.assess('s1', 'pm25');
    expect(result.level).toBe('unhealthy');
  });

  it('pH를 hazardous로 평가한다 (낮을수록 위험)', () => {
    ai.ingestMeasurement({
      stationId: 's1',
      kind: 'ph',
      value: 3.5,
      unit: 'pH',
      measuredAt: 't',
    });
    const result = ai.assess('s1', 'ph');
    expect(result.level).toBe('hazardous');
  });

  it('미등록 측정소의 측정값은 거부한다', () => {
    expect(() =>
      ai.ingestMeasurement({
        stationId: 'unknown',
        kind: 'pm10',
        value: 10,
        unit: 'ug/m3',
        measuredAt: 't',
      }),
    ).toThrow('측정소 미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerStation(
        { stationId: 's2', name: 'x', region: 'r', installedAt: 't' },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
