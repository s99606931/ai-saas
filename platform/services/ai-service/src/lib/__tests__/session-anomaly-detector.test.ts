// MTU-N349 세션 이상 탐지 테스트
import { describe, it, expect } from 'vitest';
import { SessionAnomalyDetectorService } from '../session-anomaly-detector.js';

describe('MTU-N349 SessionAnomalyDetector', () => {
  const svc = new SessionAnomalyDetectorService('tenant-n349');

  it('FR-N349.1: 세션 이벤트 기록', () => {
    const e = svc.record('sess-1', 'user-1', 'login', '1.2.3.4', 'KR', 'Chrome/100');
    expect(e).toBeDefined();
  });

  it('FR-N349.2: 세션 위험도 평가', () => {
    const e1 = svc.record('sess-2', 'user-2', 'login', '1.2.3.4', 'KR', 'Chrome/100');
    const e2 = svc.record('sess-2', 'user-2', 'api_call', '5.6.7.8', 'US', 'Firefox/90');
    const assessment = svc.assess('sess-2', [e1, e2]);
    expect(assessment).toBeDefined();
  });

  it('FR-N349.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
