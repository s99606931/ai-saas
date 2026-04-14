import { describe, it, expect, beforeEach } from 'vitest';
import { MultiTenantCostOptimizerV3 } from '../multi-tenant-cost-optimizer-v3';

describe('MultiTenantCostOptimizerV3', () => {
  let opt: MultiTenantCostOptimizerV3;

  beforeEach(() => {
    opt = new MultiTenantCostOptimizerV3();
    opt.registerTenant({ tenantId: 't1', budget: 10000 });
  });

  it('recommends OK at low waste', () => {
    const v = opt.reportUsage({
      tenantId: 't1',
      contactId: '900101-1',
      totalCost: 1000,
      idleCost: 50,
    });
    expect(v.wasteRate).toBe(5);
    expect(v.recommendation).toBe('OK');
    expect(v.maskedContactId).toHaveLength(16);
    expect(v.maskedContactId).not.toContain('900101');
  });

  it('recommends REVIEW at mid waste', () => {
    const v = opt.reportUsage({
      tenantId: 't1',
      contactId: 'c',
      totalCost: 1000,
      idleCost: 200,
    });
    expect(v.recommendation).toBe('REVIEW');
  });

  it('recommends RESIZE at high waste', () => {
    const v = opt.reportUsage({
      tenantId: 't1',
      contactId: 'c',
      totalCost: 1000,
      idleCost: 400,
    });
    expect(v.recommendation).toBe('RESIZE');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const usage = { tenantId: 't1', contactId: 'c', totalCost: 1000, idleCost: 100 };
    expect(() => opt.reportUsage(usage, 'C')).toThrow('BLOCKED');
    expect(() => opt.reportUsage(usage, 'S')).toThrow('BLOCKED');
  });

  it('rejects unknown tenant, invalid budget, invalid usage', () => {
    expect(() =>
      opt.reportUsage({ tenantId: 'x', contactId: 'c', totalCost: 1, idleCost: 0 }),
    ).toThrow('UNKNOWN_TENANT');
    expect(() => opt.registerTenant({ tenantId: 'y', budget: 0 })).toThrow('INVALID_BUDGET');
    expect(() =>
      opt.reportUsage({ tenantId: 't1', contactId: 'c', totalCost: 1000, idleCost: 2000 }),
    ).toThrow('INVALID_USAGE');
  });

  it('audit log masks contact id', () => {
    opt.reportUsage({
      tenantId: 't1',
      contactId: '900101-1234567',
      totalCost: 1000,
      idleCost: 100,
    });
    const log = opt.getAuditLog();
    expect(log.some((e) => e.action === 'REPORT_USAGE')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
