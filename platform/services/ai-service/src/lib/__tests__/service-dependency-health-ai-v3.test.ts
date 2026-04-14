import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceDependencyHealthAIV3 } from '../service-dependency-health-ai-v3';

describe('ServiceDependencyHealthAIV3', () => {
  let svc: ServiceDependencyHealthAIV3;

  beforeEach(() => {
    svc = new ServiceDependencyHealthAIV3();
  });

  it('returns HEALTHY when no deps are down', () => {
    svc.register({ name: 'db', status: 'HEALTHY', dependsOn: [] });
    svc.register({ name: 'api', status: 'HEALTHY', dependsOn: ['db'] });
    const r = svc.evaluate();
    expect(r.every((n) => n.effectiveStatus === 'HEALTHY')).toBe(true);
  });

  it('marks dependents as IMPACTED when dep is DOWN', () => {
    svc.register({ name: 'db', status: 'DOWN', dependsOn: [] });
    svc.register({ name: 'api', status: 'HEALTHY', dependsOn: ['db'] });
    const r = svc.evaluate();
    const api = r.find((n) => n.status === 'HEALTHY')!;
    expect(api.effectiveStatus).toBe('IMPACTED');
  });

  it('keeps DOWN status (no double label)', () => {
    svc.register({ name: 'svc', status: 'DOWN', dependsOn: [] });
    const r = svc.evaluate();
    expect(r[0]!.effectiveStatus).toBe('DOWN');
  });

  it('masks service names', () => {
    svc.register({ name: 'payment-svc', status: 'HEALTHY', dependsOn: [] });
    const r = svc.evaluate();
    expect(r[0]!.maskedName).toMatch(/^[0-9a-f]{16}$/);
    expect(r[0]!.maskedName).not.toContain('payment');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    svc.register({ name: 'a', status: 'HEALTHY', dependsOn: [] });
    expect(() => svc.evaluate('C')).toThrow('BLOCKED');
    expect(() => svc.evaluate('S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    svc.register({ name: 'a', status: 'HEALTHY', dependsOn: [] });
    svc.evaluate();
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'REGISTER_NODE')).toBe(true);
    expect(log.some((e) => e.action === 'EVALUATE')).toBe(true);
  });
});
