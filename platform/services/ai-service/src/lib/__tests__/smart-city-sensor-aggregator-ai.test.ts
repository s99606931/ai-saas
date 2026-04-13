import { describe, it, expect, beforeEach } from 'vitest';
import { SmartCitySensorAggregatorAI } from '../smart-city-sensor-aggregator-ai';

describe('SmartCitySensorAggregatorAI', () => {
  let ai: SmartCitySensorAggregatorAI;

  beforeEach(() => {
    ai = new SmartCitySensorAggregatorAI();
    ai.registerSensor({ sensorId: 's1', kind: 'temperature', zone: 'zoneA', unit: 'C' });
    ai.registerSensor({ sensorId: 's2', kind: 'noise', zone: 'zoneA', unit: 'dB' });
  });

  it('센서를 등록한다', () => {
    expect(ai.listSensorsByZone('zoneA').length).toBe(2);
  });

  it('측정값을 수집하고 통계를 계산한다', () => {
    for (const v of [10, 12, 14, 16, 18]) {
      ai.ingestReading({ sensorId: 's1', value: v, recordedAt: 't' });
    }
    const stats = ai.computeStats('s1');
    expect(stats.count).toBe(5);
    expect(stats.avg).toBe(14);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(18);
  });

  it('이상값을 탐지한다', () => {
    for (const v of [10, 10, 10, 10, 50]) {
      ai.ingestReading({ sensorId: 's1', value: v, recordedAt: 't' });
    }
    const anomalies = ai.detectAnomalies('s1', 1.5);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]!.value).toBe(50);
  });

  it('stdDev가 0이면 이상값 없음', () => {
    for (const v of [5, 5, 5]) {
      ai.ingestReading({ sensorId: 's1', value: v, recordedAt: 't' });
    }
    const anomalies = ai.detectAnomalies('s1');
    expect(anomalies.length).toBe(0);
  });

  it('미등록 센서의 측정값은 거부한다', () => {
    expect(() => ai.ingestReading({ sensorId: 'x', value: 1, recordedAt: 't' })).toThrow('센서 미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerSensor({ sensorId: 'x', kind: 'humidity', zone: 'z', unit: '%' }, 'C'),
    ).toThrow('BLOCKED');
  });
});
