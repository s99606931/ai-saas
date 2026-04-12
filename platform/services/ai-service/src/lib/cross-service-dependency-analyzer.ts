// Design Ref: §컴포넌트 설계 — DFS 사이클 탐지 + BFS 임팩트 분석
// Plan SC: FR-R214.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ServiceNode {
  id: string;
  name: string;
  metadata: Record<string, string>;
}

interface Dependency {
  fromId: string;
  toId: string;
  type: string;
}

interface CycleResult {
  cycle: string[];
  severity: 'high';
}

interface ImpactResult {
  serviceId: string;
  distance: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R214.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class CrossServiceDependencyAnalyzer {
  private services = new Map<string, ServiceNode>();
  private dependencies: Dependency[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R214.1
  registerService(id: string, name: string, metadata: Record<string, string> = {}): void {
    this.services.set(id, { id, name, metadata });
    this.log('REGISTER_SERVICE', { id, name });
  }

  // Plan SC: FR-R214.2
  addDependency(fromId: string, toId: string, type: string = 'sync'): void {
    if (!this.services.has(fromId) || !this.services.has(toId)) {
      throw new Error(`서비스 미등록: ${fromId} 또는 ${toId}`);
    }
    this.dependencies.push({ fromId, toId, type });
    this.log('ADD_DEPENDENCY', { fromId, toId, type });
  }

  // Plan SC: FR-R214.3
  detectCycles(): CycleResult[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const cycles: CycleResult[] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      visiting.add(nodeId);
      const neighbors = this.dependencies
        .filter(d => d.fromId === nodeId)
        .map(d => d.toId);

      for (const neighbor of neighbors) {
        if (visiting.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push({ cycle: [...path.slice(cycleStart), neighbor], severity: 'high' });
        } else if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    for (const serviceId of this.services.keys()) {
      if (!visited.has(serviceId)) {
        dfs(serviceId, [serviceId]);
      }
    }

    this.log('DETECT_CYCLES', { count: cycles.length });
    return cycles;
  }

  // Plan SC: FR-R214.4
  getImpactedServices(serviceId: string, grade: DataGrade = DataGrade.O): ImpactResult[] {
    guardDataGrade(grade);

    const visited = new Map<string, number>();
    const queue: Array<{ id: string; distance: number }> = [{ id: serviceId, distance: 0 }];

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.set(id, distance);

      const dependents = this.dependencies
        .filter(d => d.toId === id)
        .map(d => d.fromId);

      for (const dep of dependents) {
        if (!visited.has(dep)) {
          queue.push({ id: dep, distance: distance + 1 });
        }
      }
    }

    visited.delete(serviceId);
    this.log('GET_IMPACTED_SERVICES', { serviceId, count: visited.size });
    return Array.from(visited.entries()).map(([id, distance]) => ({ serviceId: id, distance }));
  }

  getSPOF(): string[] {
    const inDegree = new Map<string, number>();
    for (const svcId of this.services.keys()) {
      inDegree.set(svcId, 0);
    }
    for (const dep of this.dependencies) {
      inDegree.set(dep.toId, (inDegree.get(dep.toId) ?? 0) + 1);
    }
    return Array.from(inDegree.entries())
      .filter(([, count]) => count >= 3)
      .map(([id]) => id);
  }

  // Plan SC: FR-R214.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
