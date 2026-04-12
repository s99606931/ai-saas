import { describe, it, expect } from 'vitest';
import { KedaVpaAutoscale } from '../keda-vpa-autoscale';

describe('KedaVpaAutoscale', () => {
  const cfg = { enabled: true, namespace: 'default', version: '1.0.0' };
  const rule = { id: 'r1', name: 'rule-1', severity: 'high' as const, action: 'alert' as const };

  it('config validation', () => {
    const svc = new KedaVpaAutoscale();
    expect(svc.validateConfig(cfg)).toBe(true);
    expect(svc.validateConfig({ ...cfg, namespace: '' })).toBe(false);
  });

  it('rule registration', () => {
    const svc = new KedaVpaAutoscale();
    svc.registerRule(rule);
    expect(() => svc.registerRule(rule)).toThrow();
  });

  it('event evaluation', () => {
    const svc = new KedaVpaAutoscale();
    svc.registerRule(rule);
    const ev = svc.evaluate('u1', 'r1', 'r1');
    expect(ev.severity).toBe('high');
  });

  it('status query', () => {
    const svc = new KedaVpaAutoscale();
    svc.registerRule(rule);
    svc.evaluate('u', 'r', 'r1');
    expect(svc.getStatus().eventsProcessed).toBe(1);
  });

  it('audit log', () => {
    const svc = new KedaVpaAutoscale();
    svc.registerRule(rule);
    svc.evaluate('u', 'r', 'r1');
    expect(svc.getAuditLog().length).toBe(1);
  });
});
