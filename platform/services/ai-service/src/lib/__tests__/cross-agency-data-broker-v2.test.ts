import { describe, it, expect, beforeEach } from 'vitest';
import { CrossAgencyDataBrokerV2 } from '../cross-agency-data-broker-v2';

describe('CrossAgencyDataBrokerV2', () => {
  let broker: CrossAgencyDataBrokerV2;

  beforeEach(() => {
    broker = new CrossAgencyDataBrokerV2();
  });

  const base = {
    requestId: 'r1',
    fromAgency: 'AGENCY_A',
    toAgency: 'AGENCY_B',
    requesterEmail: 'req@agency.gov',
    fields: ['id', 'name'],
  };

  it('ALLOWs same-agency non-sensitive exchange', () => {
    const r = broker.request({ ...base, toAgency: 'AGENCY_A' });
    expect(r.decision).toBe('ALLOW');
  });

  it('MASKs cross-agency with sensitive fields', () => {
    const r = broker.request({ ...base, fields: ['id', 'phone', 'email'] });
    expect(r.decision).toBe('MASK');
    expect(r.sensitiveFields).toEqual(expect.arrayContaining(['phone', 'email']));
  });

  it('DENYs when blocked fields present', () => {
    const r = broker.request({ ...base, fields: ['id', 'ssn'] });
    expect(r.decision).toBe('DENY');
    expect(r.blockedFields).toContain('ssn');
  });

  it('ALLOWs cross-agency non-sensitive fields', () => {
    const r = broker.request({ ...base, fields: ['id', 'name', 'category'] });
    expect(r.decision).toBe('ALLOW');
  });

  it('masks requesterEmail as SHA-256 16-hex', () => {
    const r = broker.request(base);
    expect(r.maskedRequester).toHaveLength(16);
    expect(r.maskedRequester).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedRequester).not.toContain('@');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => broker.request(base, 'C')).toThrow('BLOCKED');
    expect(() => broker.request(base, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    broker.request(base);
    expect(broker.getAuditLog().some((e) => e.action === 'BROKER_REQUEST')).toBe(true);
  });
});
