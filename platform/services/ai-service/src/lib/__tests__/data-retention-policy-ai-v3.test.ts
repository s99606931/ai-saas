import { describe, it, expect, beforeEach } from 'vitest';
import { DataRetentionPolicyAIV3 } from '../data-retention-policy-ai-v3';

describe('DataRetentionPolicyAIV3', () => {
  let svc: DataRetentionPolicyAIV3;
  const now = new Date('2026-04-14T00:00:00Z');

  beforeEach(() => {
    svc = new DataRetentionPolicyAIV3();
  });

  it('returns 365 days for audit category', () => {
    const r = svc.evaluate(
      { category: 'audit', createdAt: now, recordOwner: 'gov1' },
      undefined,
      now,
    );
    expect(r.retentionDays).toBe(365);
    expect(r.expired).toBe(false);
  });

  it('flags expired temp record (older than 30 days)', () => {
    const old = new Date('2025-01-01T00:00:00Z');
    const r = svc.evaluate(
      { category: 'temp', createdAt: old, recordOwner: 'gov1' },
      undefined,
      now,
    );
    expect(r.expired).toBe(true);
  });

  it('citizen records have 1825-day retention', () => {
    const r = svc.evaluate(
      { category: 'citizen', createdAt: now, recordOwner: 'gov1' },
      undefined,
      now,
    );
    expect(r.retentionDays).toBe(1825);
  });

  it('masks recordOwner', () => {
    const r = svc.evaluate(
      { category: 'audit', createdAt: now, recordOwner: 'admin@city.gov' },
      undefined,
      now,
    );
    expect(r.maskedOwner).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedOwner).not.toContain('admin');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const inp = { category: 'audit' as const, createdAt: now, recordOwner: 'g' };
    expect(() => svc.evaluate(inp, 'C', now)).toThrow('BLOCKED');
    expect(() => svc.evaluate(inp, 'S', now)).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    svc.evaluate({ category: 'audit', createdAt: now, recordOwner: 'g' }, undefined, now);
    expect(svc.getAuditLog().some((e) => e.action === 'EVALUATE_RETENTION')).toBe(true);
  });
});
