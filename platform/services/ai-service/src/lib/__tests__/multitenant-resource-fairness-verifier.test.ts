import { describe, it, expect, beforeEach } from 'vitest';
import { MultitenantResourceFairnessVerifier, type TenantResource } from '../multitenant-resource-fairness-verifier';

describe('MultitenantResourceFairnessVerifier', () => {
  let verifier: MultitenantResourceFairnessVerifier;

  beforeEach(() => {
    verifier = new MultitenantResourceFairnessVerifier();
  });

  it('marks OVER_QUOTA when cpuAlloc > quota*1.1', () => {
    const tenants: TenantResource[] = [
      { tenantId: 'T1', cpuAlloc: 120, memAllocGB: 10, storageGB: 10, quota: { cpu: 100, mem: 100, storage: 100 } },
    ];
    const report = verifier.verify(tenants);
    expect(report.tenants[0]!.cpuStatus).toBe('OVER_QUOTA');
    expect(report.tenants[0]!.overallStatus).toBe('OVER_QUOTA');
  });

  it('marks UNDER_UTILIZED when memAlloc < quota*0.1', () => {
    const tenants: TenantResource[] = [
      { tenantId: 'T2', cpuAlloc: 50, memAllocGB: 1, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
    ];
    const report = verifier.verify(tenants);
    expect(report.tenants[0]!.memStatus).toBe('UNDER_UTILIZED');
    expect(report.tenants[0]!.overallStatus).toBe('UNDER_UTILIZED');
  });

  it('marks FAIR when all allocations within bounds', () => {
    const tenants: TenantResource[] = [
      { tenantId: 'T3', cpuAlloc: 50, memAllocGB: 50, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
    ];
    const report = verifier.verify(tenants);
    expect(report.tenants[0]!.overallStatus).toBe('FAIR');
  });

  it('computes fairnessScore as percentage of FAIR tenants', () => {
    const tenants: TenantResource[] = [
      { tenantId: 'T4', cpuAlloc: 50, memAllocGB: 50, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
      { tenantId: 'T5', cpuAlloc: 200, memAllocGB: 50, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
    ];
    const report = verifier.verify(tenants);
    expect(report.fairnessScore).toBe(50);
  });

  it('OVER_QUOTA takes priority over UNDER_UTILIZED in overallStatus', () => {
    const tenants: TenantResource[] = [
      { tenantId: 'T6', cpuAlloc: 120, memAllocGB: 1, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
    ];
    const report = verifier.verify(tenants);
    expect(report.tenants[0]!.overallStatus).toBe('OVER_QUOTA');
  });

  it('records audit log', () => {
    verifier.verify([
      { tenantId: 'T7', cpuAlloc: 50, memAllocGB: 50, storageGB: 50, quota: { cpu: 100, mem: 100, storage: 100 } },
    ]);
    const log = verifier.getAuditLog();
    expect(log[0]!.action).toBe('fairness.verify');
  });
});
