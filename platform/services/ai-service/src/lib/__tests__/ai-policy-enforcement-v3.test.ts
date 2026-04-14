import { describe, it, expect } from 'vitest';
import { AiPolicyEnforcementV3 } from '../ai-policy-enforcement-v3.js';

describe('SVC-AI-ADV-R601 (v3) AiPolicyEnforcementV3', () => {
  const svc = new AiPolicyEnforcementV3();

  it('FR-R601v3.2: C등급 → BLOCKED', () => {
    expect(() =>
      svc.enforce({
        id: 'p1',
        grade: 'C',
        actorEmail: 'admin@gov.kr',
        action: 'READ',
        resource: 'staging',
        attemptCount: 0,
      })
    ).toThrow(/BLOCKED.*N2SF N-05/);
  });

  it('FR-R601v3.4: production DELETE → CRITICAL & blocked', () => {
    const r = svc.enforce({
      id: 'p2',
      grade: 'O',
      actorEmail: 'ops@gov.kr',
      action: 'DELETE',
      resource: 'production',
      attemptCount: 1,
    });
    expect(r.severity).toBe('CRITICAL');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('PRODUCTION_DELETE_BLOCKED');
  });

  it('FR-R601v3.4: attemptCount>5 → HIGH & blocked', () => {
    const r = svc.enforce({
      id: 'p3',
      grade: 'O',
      actorEmail: 'user@gov.kr',
      action: 'READ',
      resource: 'staging',
      attemptCount: 10,
    });
    expect(r.severity).toBe('HIGH');
    expect(r.allowed).toBe(false);
  });

  it('FR-R601v3.4: 일반 요청 → LOW & allowed', () => {
    const r = svc.enforce({
      id: 'p4',
      grade: 'O',
      actorEmail: 'user@gov.kr',
      action: 'READ',
      resource: 'staging',
      attemptCount: 1,
    });
    expect(r.severity).toBe('LOW');
    expect(r.allowed).toBe(true);
  });

  it('FR-R601v3.3: actorEmail SHA-256 16자 마스킹', () => {
    const r = svc.enforce({
      id: 'p5',
      grade: 'O',
      actorEmail: 'sensitive@gov.kr',
      action: 'WRITE',
      resource: 'staging',
      attemptCount: 0,
    });
    expect(r.maskedActor).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedActor).not.toContain('@');
  });

  it('FR-R601v3.5: getAuditLog 누적 기록', () => {
    const local = new AiPolicyEnforcementV3();
    local.enforce({
      id: 'p6',
      grade: 'O',
      actorEmail: 'a@gov.kr',
      action: 'READ',
      resource: 'staging',
      attemptCount: 0,
    });
    local.enforce({
      id: 'p7',
      grade: 'O',
      actorEmail: 'b@gov.kr',
      action: 'WRITE',
      resource: 'staging',
      attemptCount: 0,
    });
    const log = local.getAuditLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.action).toBe('ENFORCE');
  });
});
