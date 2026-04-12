// 서비스 카탈로그 AI — FR-N405.1~5

export interface ServiceEntity {
  id: string;
  name: string;
  kind: 'api' | 'worker' | 'batch' | 'frontend';
  owner: string;
  team: string;
  tier: 1 | 2 | 3;
  dependencies: string[];
  tags: string[];
  sloTargets: {
    availability: number;
    latencyMsP99: number;
    errorRate: number;
  };
}

export interface CatalogGraph {
  services: ServiceEntity[];
  edges: Array<{ from: string; to: string }>;
}

export class ServiceCatalogAi {
  private readonly services = new Map<string, ServiceEntity>();

  register(svc: ServiceEntity): void {
    if (svc.sloTargets.availability < 0 || svc.sloTargets.availability > 1) {
      throw new Error('CATALOG_INVALID_SLO');
    }
    this.services.set(svc.id, svc);
  }

  graph(): CatalogGraph {
    const services = Array.from(this.services.values());
    const edges: Array<{ from: string; to: string }> = [];
    for (const s of services) {
      for (const dep of s.dependencies) {
        if (this.services.has(dep)) edges.push({ from: s.id, to: dep });
      }
    }
    return { services, edges };
  }

  transitiveDeps(serviceId: string): string[] {
    const visited = new Set<string>();
    const stack = [serviceId];
    const out: string[] = [];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur) continue;
      const svc = this.services.get(cur);
      if (!svc) continue;
      for (const dep of svc.dependencies) {
        if (!visited.has(dep)) {
          visited.add(dep);
          out.push(dep);
          stack.push(dep);
        }
      }
    }
    return out;
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (id: string): void => {
      if (visiting.has(id)) {
        const idx = stack.indexOf(id);
        if (idx >= 0) cycles.push(stack.slice(idx).concat(id));
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      stack.push(id);
      const svc = this.services.get(id);
      if (svc) {
        for (const dep of svc.dependencies) dfs(dep);
      }
      stack.pop();
      visiting.delete(id);
      visited.add(id);
    };

    for (const id of this.services.keys()) dfs(id);
    return cycles;
  }

  ownership(): Record<string, ServiceEntity[]> {
    const out: Record<string, ServiceEntity[]> = {};
    for (const svc of this.services.values()) {
      const list = out[svc.team] ?? [];
      list.push(svc);
      out[svc.team] = list;
    }
    return out;
  }

  findSimilar(serviceId: string, limit = 3): ServiceEntity[] {
    const target = this.services.get(serviceId);
    if (!target) throw new Error('CATALOG_SERVICE_NOT_FOUND');
    const scored = Array.from(this.services.values())
      .filter((s) => s.id !== serviceId)
      .map((s) => ({
        svc: s,
        score:
          (s.kind === target.kind ? 2 : 0) +
          (s.tier === target.tier ? 1 : 0) +
          s.tags.filter((t) => target.tags.includes(t)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((e) => e.svc);
  }

  search(keyword: string): ServiceEntity[] {
    const k = keyword.toLowerCase();
    return Array.from(this.services.values()).filter((s) => {
      const hay = `${s.name} ${s.owner} ${s.team} ${s.tags.join(' ')}`.toLowerCase();
      return hay.includes(k);
    });
  }
}
