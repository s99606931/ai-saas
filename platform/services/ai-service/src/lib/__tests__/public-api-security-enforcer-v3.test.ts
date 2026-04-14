import { describe, it, expect, beforeEach } from 'vitest';
import { PublicApiSecurityEnforcerV3 } from '../public-api-security-enforcer-v3';

describe('PublicApiSecurityEnforcerV3', () => {
  let enforcer: PublicApiSecurityEnforcerV3;

  beforeEach(() => {
    enforcer = new PublicApiSecurityEnforcerV3();
    enforcer.registerPolicy({ apiId: 'api1', requireAuth: true, maxRps: 100 });
  });

  it('ALLOWs compliant request', () => {
    const v = enforcer.evaluateRequest({
      apiId: 'api1',
      clientId: '900101-1',
      hasAuth: true,
      rps: 50,
      tls: true,
    });
    expect(v.violationScore).toBe(0);
    expect(v.decision).toBe('ALLOW');
    expect(v.maskedClientId).toHaveLength(16);
    expect(v.maskedClientId).not.toContain('900101');
  });

  it('WARNs on rate overage only', () => {
    const v = enforcer.evaluateRequest({
      apiId: 'api1',
      clientId: 'c',
      hasAuth: true,
      rps: 200,
      tls: true,
    });
    expect(v.violationScore).toBe(30);
    expect(v.decision).toBe('WARN');
  });

  it('BLOCKs on missing auth + over rate', () => {
    const v = enforcer.evaluateRequest({
      apiId: 'api1',
      clientId: 'c',
      hasAuth: false,
      rps: 200,
      tls: true,
    });
    expect(v.violationScore).toBe(80);
    expect(v.decision).toBe('BLOCK');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const req = { apiId: 'api1', clientId: 'c', hasAuth: true, rps: 1, tls: true };
    expect(() => enforcer.evaluateRequest(req, 'C')).toThrow('BLOCKED');
    expect(() => enforcer.evaluateRequest(req, 'S')).toThrow('BLOCKED');
  });

  it('rejects unknown api and invalid maxRps', () => {
    expect(() =>
      enforcer.evaluateRequest({
        apiId: 'missing',
        clientId: 'c',
        hasAuth: true,
        rps: 1,
        tls: true,
      }),
    ).toThrow('UNKNOWN_API');
    expect(() =>
      enforcer.registerPolicy({ apiId: 'x', requireAuth: true, maxRps: 0 }),
    ).toThrow('INVALID_RPS');
  });

  it('audit log masks client id', () => {
    enforcer.evaluateRequest({
      apiId: 'api1',
      clientId: '900101-1234567',
      hasAuth: true,
      rps: 1,
      tls: true,
    });
    const log = enforcer.getAuditLog();
    expect(log.some((e) => e.action === 'EVALUATE_REQUEST')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
