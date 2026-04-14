import { describe, it, expect, beforeEach } from 'vitest';
import { ZeroTrustAccessAIV2 } from '../zero-trust-access-ai-v2';

describe('ZeroTrustAccessAIV2', () => {
  let zt: ZeroTrustAccessAIV2;

  beforeEach(() => {
    zt = new ZeroTrustAccessAIV2();
  });

  const base = {
    requestId: 'r1',
    userId: 'user@example.com',
    knownDevice: true,
    offHours: false,
    newLocation: false,
    failedAttempts: 0,
    resource: 'api/reports',
  };

  it('ALLOWs low-risk known-device request', () => {
    const r = zt.evaluate(base);
    expect(r.decision).toBe('ALLOW');
    expect(r.riskScore).toBe(0);
  });

  it('CHALLENGEs unknown device', () => {
    const r = zt.evaluate({ ...base, knownDevice: false });
    expect(r.decision).toBe('CHALLENGE');
    expect(r.riskScore).toBe(40);
  });

  it('DENYs high-risk combo', () => {
    const r = zt.evaluate({
      ...base,
      knownDevice: false,
      offHours: true,
      newLocation: true,
      failedAttempts: 3,
    });
    expect(r.decision).toBe('DENY');
    expect(r.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('masks userId as SHA-256 16-hex', () => {
    const r = zt.evaluate(base);
    expect(r.maskedUserId).toHaveLength(16);
    expect(r.maskedUserId).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedUserId).not.toContain('@');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => zt.evaluate(base, 'C')).toThrow('BLOCKED');
    expect(() => zt.evaluate(base, 'S')).toThrow('BLOCKED');
  });

  it('maintains audit log', () => {
    zt.evaluate(base);
    expect(zt.getAuditLog().some((e) => e.action === 'EVALUATE_ACCESS')).toBe(true);
  });
});
