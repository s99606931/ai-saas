// Design Ref: MTU-N427 §인프라 비용 귀속
// Plan SC: FR-N427.1~5

export interface ResourceCost {
  resourceId: string;
  resourceType: 'compute' | 'storage' | 'network' | 'db';
  cost: number;
  tags: Record<string, string>;
  cpuShare?: number;
  memoryShare?: number;
}

export interface ServiceUsage {
  serviceId: string;
  cpuUnits: number;
  memoryMb: number;
}

export interface ServiceCost {
  serviceId: string;
  directCost: number;
  sharedCost: number;
  total: number;
}

export class CostAttribution {
  /** FR-N427.1 서비스 매핑 */
  mapToService(resources: ResourceCost[]): Map<string, ResourceCost[]> {
    const map = new Map<string, ResourceCost[]>();
    for (const r of resources) {
      const svc = r.tags.service ?? 'shared';
      const arr = map.get(svc) ?? [];
      arr.push(r);
      map.set(svc, arr);
    }
    return map;
  }

  /** FR-N427.2 공유 비용 분배 */
  distributeShared(
    sharedResources: ResourceCost[],
    usages: ServiceUsage[],
  ): Record<string, number> {
    const totalShared = sharedResources.reduce((s, r) => s + r.cost, 0);
    const totalCpu = usages.reduce((s, u) => s + u.cpuUnits, 0) || 1;
    const totalMem = usages.reduce((s, u) => s + u.memoryMb, 0) || 1;
    const distribution: Record<string, number> = {};
    for (const u of usages) {
      const weight = (u.cpuUnits / totalCpu) * 0.6 + (u.memoryMb / totalMem) * 0.4;
      distribution[u.serviceId] = +(totalShared * weight).toFixed(2);
    }
    return distribution;
  }

  /** FR-N427.3 서비스별 집계 */
  aggregate(resources: ResourceCost[], usages: ServiceUsage[]): ServiceCost[] {
    const mapped = this.mapToService(resources);
    const sharedRes = mapped.get('shared') ?? [];
    mapped.delete('shared');
    const sharedDist = this.distributeShared(sharedRes, usages);

    const result: ServiceCost[] = [];
    const seen = new Set<string>();
    for (const [svcId, res] of mapped.entries()) {
      const direct = res.reduce((s, r) => s + r.cost, 0);
      const shared = sharedDist[svcId] ?? 0;
      result.push({
        serviceId: svcId,
        directCost: +direct.toFixed(2),
        sharedCost: +shared,
        total: +(direct + shared).toFixed(2),
      });
      seen.add(svcId);
    }
    for (const [svcId, cost] of Object.entries(sharedDist)) {
      if (!seen.has(svcId)) {
        result.push({ serviceId: svcId, directCost: 0, sharedCost: +cost, total: +cost });
      }
    }
    return result;
  }

  /** FR-N427.4 이상치 탐지 (history 대비) */
  detectOutliers(
    current: ServiceCost[],
    history: Record<string, number[]>,
  ): Array<{ serviceId: string; current: number; avg: number; deviation: number }> {
    const outliers: Array<{ serviceId: string; current: number; avg: number; deviation: number }> = [];
    for (const c of current) {
      const past = history[c.serviceId];
      if (!past || past.length === 0) continue;
      const avg = past.reduce((s, v) => s + v, 0) / past.length;
      if (avg === 0) continue;
      const deviation = (c.total - avg) / avg;
      if (Math.abs(deviation) > 0.3) {
        outliers.push({ serviceId: c.serviceId, current: c.total, avg: +avg.toFixed(2), deviation: +deviation.toFixed(2) });
      }
    }
    return outliers;
  }

  /** FR-N427.5 절감 제안 */
  suggestSavings(costs: ServiceCost[]): Array<{ serviceId: string; suggestion: string; potentialSaving: number }> {
    const suggestions: Array<{ serviceId: string; suggestion: string; potentialSaving: number }> = [];
    const sortedByCost = [...costs].sort((a, b) => b.total - a.total);
    for (const c of sortedByCost.slice(0, 3)) {
      suggestions.push({
        serviceId: c.serviceId,
        suggestion: 'Reserved Instance 구매로 20% 절감 가능',
        potentialSaving: +(c.total * 0.2).toFixed(2),
      });
    }
    return suggestions;
  }
}

export const costAttribution = new CostAttribution();
