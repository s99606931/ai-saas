// Design Ref: §SVC-AI-ADV-R519 — AI기반 서비스 의존성 문서 자동화 v3
// Plan SC: FR-R519.1~5

export interface ServiceDep {
  readonly serviceId: string;
  readonly name: string;
  readonly dependsOn: readonly string[];
}

export interface DepAnalysis {
  readonly serviceId: string;
  readonly depth: number;
  readonly impactedBy: number;
  readonly hasCycle: boolean;
}

export interface DependencyReport {
  readonly services: readonly DepAnalysis[];
  readonly hasCycles: boolean;
  readonly cycleServices: readonly string[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ServiceDependencyDocAutomatorV3 {
  private readonly auditLog: AuditEvent[] = [];

  private computeDepths(services: readonly ServiceDep[]): Map<string, number> {
    const depths = new Map<string, number>();
    const queue: string[] = [];

    // Roots: services with no dependsOn
    for (const s of services) {
      if (s.dependsOn.length === 0) {
        depths.set(s.serviceId, 0);
        queue.push(s.serviceId);
      }
    }

    // BFS
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDepth = depths.get(current) ?? 0;
      for (const s of services) {
        if (s.dependsOn.includes(current) && !depths.has(s.serviceId)) {
          depths.set(s.serviceId, currentDepth + 1);
          queue.push(s.serviceId);
        }
      }
    }

    // Remaining services (in cycles or unreachable from root)
    for (const s of services) {
      if (!depths.has(s.serviceId)) depths.set(s.serviceId, -1);
    }

    return depths;
  }

  private detectCycles(services: readonly ServiceDep[]): Set<string> {
    const depMap = new Map<string, readonly string[]>(
      services.map(s => [s.serviceId, s.dependsOn])
    );
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycleNodes = new Set<string>();

    const dfs = (id: string): boolean => {
      if (inStack.has(id)) { cycleNodes.add(id); return true; }
      if (visited.has(id)) return false;
      visited.add(id);
      inStack.add(id);
      for (const dep of depMap.get(id) ?? []) {
        if (dfs(dep)) cycleNodes.add(id);
      }
      inStack.delete(id);
      return false;
    };

    for (const s of services) dfs(s.serviceId);
    return cycleNodes;
  }

  analyze(services: readonly ServiceDep[]): DependencyReport {
    const depths = this.computeDepths(services);
    const cycleNodes = this.detectCycles(services);

    const analyses: DepAnalysis[] = services.map(s => {
      const impactedBy = services.filter(other => other.dependsOn.includes(s.serviceId)).length;
      return {
        serviceId: s.serviceId,
        depth: depths.get(s.serviceId) ?? -1,
        impactedBy,
        hasCycle: cycleNodes.has(s.serviceId),
      };
    });

    const cycleServices = [...cycleNodes];

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'dependency.analyze',
      details: {
        serviceCount: services.length,
        hasCycles: cycleServices.length > 0,
        cycleCount: cycleServices.length,
      },
    });

    return {
      services: analyses,
      hasCycles: cycleServices.length > 0,
      cycleServices,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
