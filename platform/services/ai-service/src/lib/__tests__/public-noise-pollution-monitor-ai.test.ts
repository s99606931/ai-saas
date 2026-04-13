import { describe, it, expect, beforeEach } from 'vitest';
import { PublicNoisePollutionMonitorAI } from '../public-noise-pollution-monitor-ai';

describe('PublicNoisePollutionMonitorAI', () => {
  let svc: PublicNoisePollutionMonitorAI;

  beforeEach(() => {
    svc = new PublicNoisePollutionMonitorAI();
  });

  it('소음 데이터를 수집한다', () => {
    svc.ingestReading({ sensorId: 's1', zone: 'residential', decibel: 50, timestamp: '2026-04-13T12:00:00Z' });
    expect(svc.getAuditLog().some(e => e.action === 'INGEST_READING')).toBe(true);
  });

  it('주거지역 주간 한도 초과 시 위반', () => {
    svc.ingestReading({ sensorId: 's1', zone: 'residential', decibel: 70, timestamp: '2026-04-13T12:00:00Z' });
    const violations = svc.getViolations('s1');
    expect(violations.length).toBe(1);
    expect(violations[0]?.band).toBe('day');
  });

  it('야간 한도가 더 엄격하다', () => {
    svc.ingestReading({ sensorId: 's2', zone: 'residential', decibel: 50, timestamp: '2026-04-13T23:00:00Z' });
    expect(svc.getViolations('s2').length).toBe(1);
  });

  it('평균 데시벨 계산', () => {
    svc.ingestReading({ sensorId: 's3', zone: 'commercial', decibel: 60, timestamp: '2026-04-13T12:00:00Z' });
    svc.ingestReading({ sensorId: 's3', zone: 'commercial', decibel: 70, timestamp: '2026-04-13T13:00:00Z' });
    expect(svc.computeAverage('s3')).toBe(65);
  });

  it('위험도 산출', () => {
    for (let i = 0; i < 10; i++) {
      svc.ingestReading({ sensorId: 's4', zone: 'residential', decibel: 70, timestamp: '2026-04-13T12:00:00Z' });
    }
    expect(svc.computeRiskLevel('s4')).toBe('high');
  });

  it('S등급 데이터 차단', () => {
    expect(() => svc.ingestReading({ sensorId: 's5', zone: 'residential', decibel: 50, timestamp: '2026-04-13T12:00:00Z' }, 'S')).toThrow('BLOCKED');
  });
});
