// Plan SC: FR-R89.1~5
import { describe, it, expect } from 'vitest';
import {
  createOncallEscalationRouter,
  type Responder,
  type Incident,
} from '../oncall-escalation-router';

function r(id: string, level: 1 | 2 | 3, fatigue = 0, domains = ['infra']): Responder {
  return { id, level, fatigue, domains, available: true };
}

describe('OncallEscalationRouter', () => {
  it('FR-R89.1: registers responders', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('a', 1));
    expect(rt.getAuditLog()[0]?.action).toBe('REGISTER');
  });

  it('FR-R89.2: routes critical to level 1 responder', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('l1', 1));
    rt.register(r('l2', 2));
    const inc: Incident = { id: 'i1', severity: 'critical', domain: 'infra' };
    const res = rt.route(inc);
    expect(res.primary?.id).toBe('l1');
  });

  it('FR-R89.2: routes high to level 1 or 2', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('l1', 1, 0.9)); // 고피로 제외
    rt.register(r('l2', 2));
    const res = rt.route({ id: 'i1', severity: 'high', domain: 'infra' });
    expect(res.primary?.id).toBe('l2');
    expect(res.skipped.some((s) => s.id === 'l1')).toBe(true);
  });

  it('FR-R89.3: nextInChain escalates', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('a', 1, 0.1));
    rt.register(r('b', 1, 0.2));
    rt.register(r('c', 1, 0.3));
    rt.route({ id: 'i1', severity: 'critical', domain: 'infra' });
    const next = rt.nextInChain('i1');
    expect(next?.id).toBe('b');
  });

  it('FR-R89.4: high fatigue responders skipped', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('tired', 1, 0.95));
    const res = rt.route({ id: 'i1', severity: 'critical', domain: 'infra' });
    expect(res.primary).toBe(null);
    expect(res.skipped.some((s) => s.reason === 'high_fatigue')).toBe(true);
  });

  it('FR-R89.5: audit log contains ROUTE', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('a', 1));
    rt.route({ id: 'i1', severity: 'critical', domain: 'infra' });
    expect(rt.getAuditLog().some((e) => e.action === 'ROUTE')).toBe(true);
  });

  it('no matching domain yields NO_RESPONDER', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('db-person', 1, 0, ['db']));
    const res = rt.route({ id: 'i1', severity: 'critical', domain: 'ai' });
    expect(res.primary).toBe(null);
    expect(rt.getAuditLog().some((e) => e.action === 'NO_RESPONDER')).toBe(true);
  });

  it('addFatigue increments correctly', () => {
    const rt = createOncallEscalationRouter();
    rt.register(r('a', 1, 0.5));
    rt.addFatigue('a', 0.3);
    const res = rt.route({ id: 'i1', severity: 'critical', domain: 'infra' });
    expect(res.primary?.fatigue).toBeCloseTo(0.8);
  });

  it('rejects invalid responder', () => {
    const rt = createOncallEscalationRouter();
    expect(() =>
      rt.register({ id: '', domains: [], level: 1, fatigue: 0, available: true }),
    ).toThrow();
    expect(() =>
      rt.register({ id: 'x', domains: [], level: 1, fatigue: 1.5, available: true }),
    ).toThrow();
  });
});
