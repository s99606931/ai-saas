// Design Ref: §R175 AI기반서비스의존성최적화
// Plan SC: FR-R175.1~5

export interface ServiceNode {
  id: string;
  name: string;
  version: string;
  dependencies: string[]; // service IDs
  latencyMs?: number;
  errorRate?: number;
}

export interface DependencyIssue {
  type: 'CIRCULAR' | 'DEEP_CHAIN' | 'HIGH_LATENCY' | 'SINGLE_POINT';
  services: string[];
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OptimizationRecommendation {
  issue: DependencyIssue;
  recommendation: string;
  estimatedImpact: string;
}

export interface AuditEntry {
  action: string;
  timestamp: string;
}

export class ServiceDependencyOptimizer {
  private services = new Map<string, ServiceNode>();
  private auditLog: AuditEntry[] = [];

  // FR-R175.1 서비스 등록
  registerService(service: ServiceNode): void {
    this.services.set(service.id, { ...service, dependencies: [...service.dependencies] });
  }

  // FR-R175.2 순환 의존성 탐지 (DFS)
  detectCircular(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string, path: string[]): boolean => {
      if (stack.has(id)) {
        const cycleStart = path.indexOf(id);
        cycles.push(path.slice(cycleStart));
        return true;
      }
      if (visited.has(id)) return false;
      visited.add(id);
      stack.add(id);
      const svc = this.services.get(id);
      if (svc) {
        for (const dep of svc.dependencies) {
          dfs(dep, [...path, id]);
        }
      }
      stack.delete(id);
      return false;
    };

    for (const id of this.services.keys()) {
      dfs(id, []);
    }
    return cycles;
  }

  // FR-R175.3 깊은 체인 탐지 (3단계 이상)
  detectDeepChains(maxDepth = 3): Array<{ service: string; depth: number }> {
    const deep: Array<{ service: string; depth: number }> = [];

    const getDepth = (id: string, visited: Set<string>): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const svc = this.services.get(id);
      if (!svc || svc.dependencies.length === 0) return 0;
      return 1 + Math.max(...svc.dependencies.map((d) => getDepth(d, new Set(visited))));
    };

    for (const id of this.services.keys()) {
      const depth = getDepth(id, new Set());
      if (depth > maxDepth) deep.push({ service: id, depth });
    }
    return deep;
  }

  // FR-R175.4 최적화 권고 생성
  generateRecommendations(): OptimizationRecommendation[] {
    const recs: OptimizationRecommendation[] = [];

    const circles = this.detectCircular();
    for (const cycle of circles) {
      recs.push({
        issue: { type: 'CIRCULAR', services: cycle, description: `순환 의존성: ${cycle.join(' → ')}`, severity: 'HIGH' },
        recommendation: '의존성 역전 원칙(DIP) 적용 또는 이벤트 기반 통신으로 전환',
        estimatedImpact: '배포 안정성 향상',
      });
    }

    const deep = this.detectDeepChains();
    for (const d of deep) {
      recs.push({
        issue: { type: 'DEEP_CHAIN', services: [d.service], description: `깊은 의존성 체인 (${d.depth}단계)`, severity: 'MEDIUM' },
        recommendation: '중간 계층 서비스 캐싱 도입 또는 직접 의존성으로 단순화',
        estimatedImpact: '레이턴시 감소',
      });
    }

    for (const svc of this.services.values()) {
      if (svc.latencyMs && svc.latencyMs > 500) {
        recs.push({
          issue: { type: 'HIGH_LATENCY', services: [svc.id], description: `고지연 서비스: ${svc.latencyMs}ms`, severity: 'HIGH' },
          recommendation: '캐싱 계층 추가 또는 비동기 처리 전환',
          estimatedImpact: `응답시간 ${Math.round(svc.latencyMs * 0.6)}ms 이하로 개선 예상`,
        });
      }
    }

    this.auditLog.push({ action: 'RECOMMENDATIONS_GENERATED', timestamp: new Date().toISOString() });
    return recs;
  }

  // FR-R175.5 감사 로그 (CSAP D-06)
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
