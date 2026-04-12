// Design Ref: MTU-N435 §서비스 위상도 AI
// Plan SC: FR-N435.1~5

export interface TraceCall {
  fromService: string;
  toService: string;
  latencyMs: number;
  errorCount: number;
  callCount: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  callCount: number;
  avgLatencyMs: number;
  errorRate: number;
  strength: number;
}

export interface TopologyGraph {
  nodes: string[];
  edges: DependencyEdge[];
}

export interface BlastRadius {
  service: string;
  downstreamCount: number;
  affectedServices: string[];
}

export class ServiceTopologyAi {
  /** FR-N435.1 호출 그래프 구축 */
  buildGraph(calls: TraceCall[]): TopologyGraph {
    const edgeMap = new Map<string, DependencyEdge>();
    const nodes = new Set<string>();
    for (const c of calls) {
      nodes.add(c.fromService);
      nodes.add(c.toService);
      const key = `${c.fromService}->${c.toService}`;
      const existing = edgeMap.get(key);
      if (existing) {
        const totalCalls = existing.callCount + c.callCount;
        existing.avgLatencyMs = +(
          (existing.avgLatencyMs * existing.callCount + c.latencyMs * c.callCount) / totalCalls
        ).toFixed(2);
        existing.errorRate = +(
          (existing.errorRate * existing.callCount + (c.errorCount / Math.max(1, c.callCount)) * c.callCount) /
          totalCalls
        ).toFixed(4);
        existing.callCount = totalCalls;
      } else {
        edgeMap.set(key, {
          from: c.fromService,
          to: c.toService,
          callCount: c.callCount,
          avgLatencyMs: c.latencyMs,
          errorRate: c.errorCount / Math.max(1, c.callCount),
          strength: 0,
        });
      }
    }
    const edges = Array.from(edgeMap.values());
    // FR-N435.2 강도 계산
    const maxCalls = Math.max(...edges.map((e) => e.callCount), 1);
    for (const e of edges) {
      const callNorm = e.callCount / maxCalls;
      const latencyPenalty = Math.min(1, e.avgLatencyMs / 1000);
      e.strength = +(callNorm * 0.7 + latencyPenalty * 0.3).toFixed(3);
    }
    return { nodes: Array.from(nodes), edges };
  }

  /** FR-N435.3 순환 의존성 탐지 */
  detectCycles(graph: TopologyGraph): string[][] {
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      const list = adj.get(e.from) ?? [];
      list.push(e.to);
      adj.set(e.from, list);
    }
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack: string[] = [];
    const inStack = new Set<string>();

    const dfs = (node: string): void => {
      visited.add(node);
      stack.push(node);
      inStack.add(node);
      for (const next of adj.get(node) ?? []) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (inStack.has(next)) {
          const cycleStart = stack.indexOf(next);
          if (cycleStart >= 0) cycles.push(stack.slice(cycleStart));
        }
      }
      stack.pop();
      inStack.delete(node);
    };

    for (const n of graph.nodes) {
      if (!visited.has(n)) dfs(n);
    }
    return cycles;
  }

  /** FR-N435.4 블라스트 반경 */
  computeBlastRadius(graph: TopologyGraph, service: string): BlastRadius {
    const adj = new Map<string, string[]>();
    for (const e of graph.edges) {
      // 역방향: service 장애 시 영향받는 = service를 호출하는 서비스
      const list = adj.get(e.to) ?? [];
      list.push(e.from);
      adj.set(e.to, list);
    }
    const affected = new Set<string>();
    const queue: string[] = [service];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === undefined) break;
      for (const dep of adj.get(cur) ?? []) {
        if (!affected.has(dep)) {
          affected.add(dep);
          queue.push(dep);
        }
      }
    }
    return {
      service,
      downstreamCount: affected.size,
      affectedServices: Array.from(affected),
    };
  }

  /** FR-N435.5 Mermaid 다이어그램 생성 */
  toMermaid(graph: TopologyGraph): string {
    const lines: string[] = ['graph LR'];
    for (const e of graph.edges) {
      const label = `${e.callCount}회`;
      lines.push(`  ${e.from}-->|${label}|${e.to}`);
    }
    return lines.join('\n');
  }
}

export const serviceTopologyAi = new ServiceTopologyAi();
