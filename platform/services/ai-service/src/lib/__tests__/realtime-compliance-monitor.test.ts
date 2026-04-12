import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeComplianceMonitor } from '../realtime-compliance-monitor';

describe('RealtimeComplianceMonitor', () => {
  let monitor: RealtimeComplianceMonitor;

  beforeEach(() => {
    monitor = new RealtimeComplianceMonitor();
  });

  it('규칙을 등록한다', () => {
    monitor.registerRule('rule-1', '접근 제어', 'LOGIN_FAIL', 'count', '10', 'critical');
    const logs = monitor.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_RULE')).toBe(true);
  });

  it('이벤트를 기록하고 위반을 탐지한다', () => {
    monitor.registerRule('rule-1', '과도한 실패', 'AUTH_FAIL', 'result', 'failed', 'high');
    monitor.recordEvent('svc-a', 'AUTH_FAIL', { result: 'failed' });
    const violations = monitor.getViolations('svc-a');
    expect(violations.length).toBe(1);
    expect(violations[0]!.severity).toBe('high');
  });

  it('위반이 없으면 준수율 100%를 반환한다', () => {
    monitor.registerRule('rule-1', '테스트', 'ACCESS', 'level', 'root', 'critical');
    monitor.recordEvent('svc-b', 'ACCESS', { level: 'user' });
    const result = monitor.checkCompliance('svc-b');
    expect(result.complianceRate).toBe(100);
    expect(result.violations.length).toBe(0);
  });

  it('위반 시 준수율을 계산한다', () => {
    monitor.registerRule('rule-1', '금지', 'DELETE', 'target', 'all', 'critical');
    monitor.recordEvent('svc-c', 'DELETE', { target: 'all' });
    monitor.recordEvent('svc-c', 'DELETE', { target: 'specific' });
    const result = monitor.checkCompliance('svc-c');
    expect(result.totalEvents).toBe(2);
    expect(result.violations.length).toBe(1);
    expect(result.complianceRate).toBe(50);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    expect(() => monitor.recordEvent('svc', 'TEST', { k: 'v' }, 'C' as never)).toThrow('BLOCKED');
  });

  it('전체 위반 목록을 반환한다', () => {
    monitor.registerRule('rule-1', '테스트', 'EVT', 'key', 'bad', 'medium');
    monitor.recordEvent('svc-a', 'EVT', { key: 'bad' });
    monitor.recordEvent('svc-b', 'EVT', { key: 'bad' });
    const all = monitor.getViolations();
    expect(all.length).toBe(2);
  });

  it('이벤트 없는 서비스는 준수율 100%이다', () => {
    const result = monitor.checkCompliance('new-svc');
    expect(result.complianceRate).toBe(100);
    expect(result.totalEvents).toBe(0);
  });

  it('감사 로그가 append-only로 누적된다', () => {
    monitor.registerRule('r1', 'T', 'E', 'k', 'v');
    monitor.recordEvent('svc', 'E', { k: 'v' });
    expect(monitor.getAuditLog().length).toBeGreaterThanOrEqual(2);
  });
});
