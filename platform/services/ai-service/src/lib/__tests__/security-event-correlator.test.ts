// MTU-N365 보안 이벤트 상관분석 테스트
import { describe, it, expect } from 'vitest';
import { SecurityEventCorrelatorService, type SecurityEvent } from '../security-event-correlator.js';

describe('MTU-N365 SecurityEventCorrelator', () => {
  const svc = new SecurityEventCorrelatorService('tenant-n365');

  it('FR-N365.1: 상관 규칙 정의', () => {
    const rule = svc.defineRule('브루트포스', ['login_fail'], 60, 5, 'brute_force');
    expect(rule.ruleId).toMatch(/^cr-/);
  });

  it('FR-N365.2: 위협 탐지', () => {
    svc.defineRule('다중 실패', ['login_fail'], 60, 3, 'multi_fail');
    const events: SecurityEvent[] = Array.from({ length: 5 }, (_, i) => ({
      eventId: `e-${i}`,
      source: 'auth',
      type: 'login_fail',
      severity: 'medium',
      description: '실패',
      ip: '1.1.1.1',
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
    }));
    const detections = svc.correlate(events);
    expect(detections.length).toBeGreaterThan(0);
  });

  it('FR-N365.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
