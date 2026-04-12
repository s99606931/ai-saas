import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceCatalogAi, type ServiceEntity } from '../service-catalog-ai.js';

describe('ServiceCatalogAi', () => {
  let catalog: ServiceCatalogAi;

  const base: Omit<ServiceEntity, 'id' | 'name' | 'dependencies'> = {
    kind: 'api',
    owner: 'kim',
    team: 'platform',
    tier: 1,
    tags: ['user'],
    sloTargets: { availability: 0.999, latencyMsP99: 200, errorRate: 0.001 },
  };

  beforeEach(() => {
    catalog = new ServiceCatalogAi();
    catalog.register({ id: 'svc-a', name: 'svc-a', dependencies: ['svc-b'], ...base });
    catalog.register({ id: 'svc-b', name: 'svc-b', dependencies: ['svc-c'], ...base });
    catalog.register({ id: 'svc-c', name: 'svc-c', dependencies: [], ...base });
  });

  it('그래프 생성', () => {
    const g = catalog.graph();
    expect(g.edges).toHaveLength(2);
  });

  it('전이 의존성', () => {
    const deps = catalog.transitiveDeps('svc-a');
    expect(deps).toContain('svc-b');
    expect(deps).toContain('svc-c');
  });

  it('사이클 탐지', () => {
    catalog.register({ id: 'svc-d', name: 'svc-d', dependencies: ['svc-e'], ...base });
    catalog.register({ id: 'svc-e', name: 'svc-e', dependencies: ['svc-d'], ...base });
    const cycles = catalog.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('오너십 매트릭스', () => {
    const o = catalog.ownership();
    expect(o['platform']?.length).toBe(3);
  });

  it('유사 서비스 추천', () => {
    const similar = catalog.findSimilar('svc-a', 2);
    expect(similar.length).toBeGreaterThan(0);
  });

  it('잘못된 SLO 거부', () => {
    expect(() =>
      catalog.register({ id: 'x', name: 'x', dependencies: [], ...base, sloTargets: { availability: 2, latencyMsP99: 1, errorRate: 0 } }),
    ).toThrow('CATALOG_INVALID_SLO');
  });
});
