// MTU-N355 자원 비용 할당 테스트
import { describe, it, expect } from 'vitest';
import { ResourceCostAllocatorService } from '../resource-cost-allocator.js';

describe('MTU-N355 ResourceCostAllocator', () => {
  const svc = new ResourceCostAllocatorService('tenant-n355');

  it('FR-N355.1: 비용 항목 생성', () => {
    const item = svc.createItem('compute', 'CPU hours', 1000, 'KRW', '2026-04');
    expect(item).toBeDefined();
  });

  it('FR-N355.2: 비용 할당', () => {
    const item = svc.createItem('storage', 'Storage GB', 2000, 'KRW', '2026-04');
    const allocations = svc.allocate(item, [
      { tenantId: 'tenant-n355', usage: 60, unit: 'GB' },
      { tenantId: 'tenant-b', usage: 40, unit: 'GB' },
    ]);
    expect(Array.isArray(allocations)).toBe(true);
  });

  it('FR-N355.6: 감사 로그', () => {
    const item = svc.createItem('compute', 'CPU', 500, 'KRW', '2026-04');
    const sharesMap = new Map<string, Parameters<typeof svc.allocate>[1]>();
    sharesMap.set(item.itemId, [{ tenantId: 'tenant-n355', usage: 100, unit: 'GB' }]);
    svc.report('2026-04', [item], sharesMap);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
