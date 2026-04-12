// MTU-N308 로그 이상 탐지 테스트
import { describe, it, expect } from 'vitest';
import { LogAnomalyDetectorService } from '../log-anomaly-detector.js';

describe('MTU-N308 LogAnomalyDetector', () => {
  const svc = new LogAnomalyDetectorService('tenant-n308');

  const rawLogs = [
    { timestamp: '2026-04-11T10:00:00Z', service: 'api', level: 'info', message: 'OK' },
    { timestamp: '2026-04-11T10:01:00Z', service: 'api', level: 'info', message: 'OK' },
    { timestamp: '2026-04-11T10:02:00Z', service: 'api', level: 'error', message: 'timeout' },
  ];

  it('FR-N308.1: 로그 정규화', () => {
    const logs = svc.normalize(rawLogs);
    expect(logs.length).toBe(3);
  });

  it('FR-N308.2: 베이스라인 학습', () => {
    const logs = svc.normalize(rawLogs);
    const baseline = svc.learnBaseline('api', logs);
    expect(baseline).toBeDefined();
  });

  it('FR-N308.3: 이상 탐지', () => {
    const logs = svc.normalize(rawLogs);
    svc.learnBaseline('api', logs);
    const anomalies = svc.detect('api', logs);
    expect(Array.isArray(anomalies)).toBe(true);
  });

  it('FR-N308.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
