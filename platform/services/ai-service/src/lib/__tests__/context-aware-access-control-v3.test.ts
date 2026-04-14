import { describe, it, expect, beforeEach } from 'vitest';
import { ContextAwareAccessControlV3 } from '../context-aware-access-control-v3';

describe('ContextAwareAccessControlV3', () => {
  let control: ContextAwareAccessControlV3;

  beforeEach(() => {
    control = new ContextAwareAccessControlV3();
    control.registerPolicy({ policyId: 'p1', resource: '/admin', minTrust: 0.8 });
  });

  it('ALLOWs high trust', () => {
    const v = control.evaluate({
      resource: '/admin',
      userId: '900101-1',
      deviceTrust: 1,
      locationTrust: 1,
      timeTrust: 1,
    });
    expect(v.decision).toBe('ALLOW');
    expect(v.trust).toBe(1);
    expect(v.maskedUserId).toHaveLength(16);
    expect(v.maskedUserId).not.toContain('900101');
  });

  it('CHALLENGEs mid trust', () => {
    const v = control.evaluate({
      resource: '/admin',
      userId: 'u',
      deviceTrust: 0.6,
      locationTrust: 0.6,
      timeTrust: 0.6,
    });
    expect(v.decision).toBe('CHALLENGE');
  });

  it('DENYs very low trust', () => {
    const v = control.evaluate({
      resource: '/admin',
      userId: 'u',
      deviceTrust: 0.1,
      locationTrust: 0.2,
      timeTrust: 0.2,
    });
    expect(v.decision).toBe('DENY');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      control.evaluate(
        {
          resource: '/admin',
          userId: 'u',
          deviceTrust: 1,
          locationTrust: 1,
          timeTrust: 1,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
    expect(() =>
      control.evaluate(
        {
          resource: '/admin',
          userId: 'u',
          deviceTrust: 1,
          locationTrust: 1,
          timeTrust: 1,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown resource, invalid trust and invalid policy threshold', () => {
    expect(() =>
      control.evaluate({
        resource: '/missing',
        userId: 'u',
        deviceTrust: 0.5,
        locationTrust: 0.5,
        timeTrust: 0.5,
      }),
    ).toThrow('UNKNOWN_RESOURCE');
    expect(() =>
      control.evaluate({
        resource: '/admin',
        userId: 'u',
        deviceTrust: 2,
        locationTrust: 0.5,
        timeTrust: 0.5,
      }),
    ).toThrow('INVALID_TRUST_INPUT');
    expect(() =>
      control.registerPolicy({ policyId: 'x', resource: '/x', minTrust: 2 }),
    ).toThrow('INVALID_TRUST_THRESHOLD');
  });

  it('audit log masks user id', () => {
    control.evaluate({
      resource: '/admin',
      userId: '900101-1234567',
      deviceTrust: 1,
      locationTrust: 1,
      timeTrust: 1,
    });
    const log = control.getAuditLog();
    expect(log.some((e) => e.action === 'EVALUATE_ACCESS')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
