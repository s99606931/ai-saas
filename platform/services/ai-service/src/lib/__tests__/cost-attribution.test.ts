import { describe, it, expect } from 'vitest';
import { CostAttribution, type ResourceCost, type ServiceUsage } from '../cost-attribution';

describe('CostAttribution', () => {
  const svc = new CostAttribution();

  const resources: ResourceCost[] = [
    { resourceId: 'r1', resourceType: 'compute', cost: 100, tags: { service: 'svc-a' } },
    { resourceId: 'r2', resourceType: 'compute', cost: 200, tags: { service: 'svc-b' } },
    { resourceId: 'r3', resourceType: 'network', cost: 50, tags: { service: 'shared' } },
  ];

  const usages: ServiceUsage[] = [
    { serviceId: 'svc-a', cpuUnits: 200, memoryMb: 500 },
    { serviceId: 'svc-b', cpuUnits: 300, memoryMb: 1000 },
  ];

  it('maps resources to services', () => {
    const map = svc.mapToService(resources);
    expect(map.get('svc-a')).toHaveLength(1);
    expect(map.get('shared')).toHaveLength(1);
  });

  it('distributes shared cost by usage', () => {
    const dist = svc.distributeShared([resources[2]!], usages);
    expect(dist['svc-a']).toBeGreaterThan(0);
    expect(dist['svc-b']).toBeGreaterThan(dist['svc-a']!);
  });

  it('aggregates total costs', () => {
    const costs = svc.aggregate(resources, usages);
    const a = costs.find((c) => c.serviceId === 'svc-a')!;
    const b = costs.find((c) => c.serviceId === 'svc-b')!;
    expect(a.directCost).toBe(100);
    expect(b.directCost).toBe(200);
    expect(a.sharedCost).toBeGreaterThan(0);
  });

  it('detects cost outliers', () => {
    const costs = [
      { serviceId: 'svc-a', directCost: 300, sharedCost: 0, total: 300 },
    ];
    const history = { 'svc-a': [100, 110, 105] };
    const outliers = svc.detectOutliers(costs, history);
    expect(outliers.length).toBe(1);
    expect(outliers[0]!.deviation).toBeGreaterThan(0.5);
  });

  it('suggests savings for top services', () => {
    const costs = [
      { serviceId: 'a', directCost: 1000, sharedCost: 0, total: 1000 },
      { serviceId: 'b', directCost: 500, sharedCost: 0, total: 500 },
    ];
    const sugg = svc.suggestSavings(costs);
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg[0]!.serviceId).toBe('a');
  });
});
