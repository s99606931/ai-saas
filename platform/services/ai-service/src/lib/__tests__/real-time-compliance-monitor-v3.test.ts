import { describe, it, expect, beforeEach } from 'vitest';
import { RealTimeComplianceMonitorV3 } from '../real-time-compliance-monitor-v3';

describe('RealTimeComplianceMonitorV3', () => {
  let mon: RealTimeComplianceMonitorV3;

  beforeEach(() => {
    mon = new RealTimeComplianceMonitorV3();
    mon.registerPolicy({ policyId: 'p1', name: 'PII Egress', severity: 'MEDIUM' });
  });

  it('classifies HIGH + BLOCK for score >= 80', () => {
    const v = mon.evaluateEvent({ eventId: 'e1', policyId: 'p1', violationScore: 90 });
    expect(v.level).toBe('HIGH');
    expect(v.action).toBe('BLOCK');
  });

  it('classifies MEDIUM + ALERT for score 40~80', () => {
    const v = mon.evaluateEvent({ eventId: 'e1', policyId: 'p1', violationScore: 50 });
    expect(v.level).toBe('MEDIUM');
    expect(v.action).toBe('ALERT');
  });

  it('classifies LOW + LOG for score < 40', () => {
    const v = mon.evaluateEvent({ eventId: 'e1', policyId: 'p1', violationScore: 10 });
    expect(v.level).toBe('LOW');
    expect(v.action).toBe('LOG');
  });

  it('escalates one rank when policy severity HIGH', () => {
    mon.registerPolicy({ policyId: 'p2', name: 'Auth Bypass', severity: 'HIGH' });
    const v = mon.evaluateEvent({ eventId: 'e1', policyId: 'p2', violationScore: 50 });
    expect(v.action).toBe('BLOCK');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      mon.evaluateEvent({ eventId: 'e', policyId: 'p1', violationScore: 50 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      mon.evaluateEvent({ eventId: 'e', policyId: 'p1', violationScore: 50 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown policy and invalid score', () => {
    expect(() =>
      mon.evaluateEvent({ eventId: 'e', policyId: 'unknown', violationScore: 50 }),
    ).toThrow('UNKNOWN_POLICY');
    expect(() =>
      mon.evaluateEvent({ eventId: 'e', policyId: 'p1', violationScore: 200 }),
    ).toThrow('INVALID_SCORE');
  });

  it('lists blocked events and maintains audit log', () => {
    mon.evaluateEvent({ eventId: 'e1', policyId: 'p1', violationScore: 95 });
    mon.evaluateEvent({ eventId: 'e2', policyId: 'p1', violationScore: 5 });
    expect(mon.getBlockedEvents().map((v) => v.eventId)).toEqual(['e1']);
    expect(mon.getAuditLog().some((e) => e.action === 'EVALUATE_EVENT')).toBe(true);
  });
});
