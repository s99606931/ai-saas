import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyComplianceValidatorV4 } from '../policy-compliance-validator-v4';

describe('PolicyComplianceValidatorV4', () => {
  let v: PolicyComplianceValidatorV4;

  beforeEach(() => {
    v = new PolicyComplianceValidatorV4();
    v.registerPolicy({ policyId: 'tls', attribute: 'tlsVersion', allowedValues: ['1.3'], severity: 'HIGH' });
    v.registerPolicy({ policyId: 'enc', attribute: 'encryption', allowedValues: ['AES-256'], severity: 'MEDIUM' });
    v.registerPolicy({ policyId: 'region', attribute: 'region', allowedValues: ['KR'], severity: 'LOW' });
  });

  it('FR-R705.3: no violations when compliant', () => {
    const r = v.evaluate({ resourceId: 'r1', attrs: { tlsVersion: '1.3', encryption: 'AES-256', region: 'KR' } });
    expect(r.violations).toHaveLength(0);
    expect(r.riskScore).toBe(0);
  });

  it('FR-R705.3: multi-violation risk score aggregation', () => {
    const r = v.evaluate({ resourceId: 'r2', attrs: { tlsVersion: '1.0', encryption: 'DES', region: 'KR' } });
    expect(r.violations).toHaveLength(2);
    expect(r.riskScore).toBe(9 + 3);
    expect(r.maskedResourceId).toHaveLength(16);
  });

  it('FR-R705.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => v.evaluate({ resourceId: 'r', attrs: {} }, 'C')).toThrow('BLOCKED');
    expect(() => v.evaluate({ resourceId: 'r', attrs: {} }, 'S')).toThrow('BLOCKED');
  });

  it('FR-R705.1: rejects invalid policy', () => {
    expect(() =>
      v.registerPolicy({ policyId: '', attribute: 'x', allowedValues: ['a'], severity: 'LOW' }),
    ).toThrow('INVALID_POLICY');
    expect(() =>
      v.registerPolicy({ policyId: 'p', attribute: 'x', allowedValues: [], severity: 'LOW' }),
    ).toThrow('EMPTY_ALLOWED_VALUES');
  });

  it('FR-R705.4: listViolations sorted by severity desc', () => {
    v.evaluate({ resourceId: 'r1', attrs: { tlsVersion: '1.0', encryption: 'DES', region: 'US' } });
    const list = v.listViolations();
    expect(list[0]!.severity).toBe('HIGH');
    expect(list[list.length - 1]!.severity).toBe('LOW');
  });

  it('FR-R705.5: audit log masks resource ids', () => {
    v.evaluate({ resourceId: 'secret-resource', attrs: { tlsVersion: '1.3', encryption: 'AES-256', region: 'KR' } });
    const logs = v.getAuditLog();
    expect(logs.some((e) => e.action === 'EVALUATE')).toBe(true);
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('secret-resource');
    }
  });
});
