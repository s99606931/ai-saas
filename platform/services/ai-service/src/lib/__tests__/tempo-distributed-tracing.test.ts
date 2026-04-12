import { describe, it, expect } from 'vitest';
import { TempoDistributedTracing } from '../tempo-distributed-tracing';

describe('TempoDistributedTracing', () => {
  const cfg = { enabled: true, namespace: 'default', version: '1.0.0' };
  const rule = { id: 'r1', name: 'rule-1', severity: 'high' as const, action: 'alert' as const };

  it('FR-N48.1.1 설정 검증', () => {
    const svc = new TempoDistributedTracing();
    expect(svc.validateConfig(cfg)).toBe(true);
    expect(svc.validateConfig({ ...cfg, namespace: '' })).toBe(false);
  });

  it('FR-N48.1.2 규칙 등록', () => {
    const svc = new TempoDistributedTracing();
    svc.registerRule(rule);
    expect(() => svc.registerRule(rule)).toThrow('Duplicate');
  });

  it('FR-N48.1.3 이벤트 평가', () => {
    const svc = new TempoDistributedTracing();
    svc.registerRule(rule);
    const ev = svc.evaluate('user1', 'resource1', 'r1');
    expect(ev.severity).toBe('high');
  });

  it('FR-N48.1.4 상태 조회', () => {
    const svc = new TempoDistributedTracing();
    svc.registerRule(rule);
    svc.evaluate('a', 'b', 'r1');
    const s = svc.getStatus();
    expect(s.healthy).toBe(true);
    expect(s.eventsProcessed).toBe(1);
  });

  it('FR-N48.1.5 감사 로그', () => {
    const svc = new TempoDistributedTracing();
    svc.registerRule(rule);
    svc.evaluate('a', 'b', 'r1');
    expect(svc.getAuditLog().length).toBe(1);
  });
});
