import { describe, it, expect, beforeEach } from 'vitest';
import { AIWildfireEarlyWarning } from '../ai-wildfire-early-warning';

describe('AIWildfireEarlyWarning', () => {
  let svc: AIWildfireEarlyWarning;

  beforeEach(() => {
    svc = new AIWildfireEarlyWarning();
  });

  it('센서 데이터를 수집한다', () => {
    svc.ingestReading({
      sensorId: 's1',
      region: '강원',
      temperatureC: 20,
      humidityPct: 60,
      windSpeedMs: 2,
      vegetationDryness: 0.2,
      reportedAt: '2026-04-13T00:00:00Z',
    });
    expect(svc.getAuditLog().some(e => e.action === 'INGEST_READING')).toBe(true);
  });

  it('정상 환경에서 안전 등급을 산출한다', () => {
    svc.ingestReading({
      sensorId: 's1',
      region: '강원',
      temperatureC: 16,
      humidityPct: 78,
      windSpeedMs: 1,
      vegetationDryness: 0.1,
      reportedAt: '2026-04-13T00:00:00Z',
    });
    const result = svc.assessRegion('강원');
    expect(result.riskLevel).toBe('safe');
    expect(result.evacuationRecommended).toBe(false);
  });

  it('극한 환경에서 critical 등급을 산출한다', () => {
    svc.ingestReading({
      sensorId: 's2',
      region: '경북',
      temperatureC: 38,
      humidityPct: 15,
      windSpeedMs: 12,
      vegetationDryness: 0.95,
      reportedAt: '2026-04-13T00:00:00Z',
    });
    const result = svc.assessRegion('경북');
    expect(result.riskLevel).toBe('critical');
    expect(result.evacuationRecommended).toBe(true);
  });

  it('알림을 발령하고 조회한다', () => {
    svc.ingestReading({
      sensorId: 's3',
      region: '충남',
      temperatureC: 35,
      humidityPct: 20,
      windSpeedMs: 10,
      vegetationDryness: 0.9,
      reportedAt: '2026-04-13T00:00:00Z',
    });
    const alert = svc.issueAlert('충남');
    expect(alert.level === 'warning' || alert.level === 'critical').toBe(true);
    expect(svc.getActiveAlerts().length).toBe(1);
  });

  it('센서 데이터 없는 지역 평가 시 오류', () => {
    expect(() => svc.assessRegion('없는지역')).toThrow('센서 데이터 없음');
  });

  it('C등급 데이터를 차단한다', () => {
    expect(() => svc.ingestReading({
      sensorId: 's4',
      region: '강원',
      temperatureC: 20,
      humidityPct: 60,
      windSpeedMs: 2,
      vegetationDryness: 0.2,
      reportedAt: '2026-04-13T00:00:00Z',
    }, 'C')).toThrow('BLOCKED');
  });
});
