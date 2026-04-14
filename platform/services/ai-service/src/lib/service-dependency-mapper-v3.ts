// Design Ref: SVC-AI-ADV-R603-v3.design.md §알고리즘
// Plan SC: SC-R603v3-1, SC-R603v3-2, SC-R603v3-3
// 트랙 A 22차

export interface DepInput {
  services: string[];
  edges: { from: string; to: string }[];
}

export interface DepAnalysis {
  totalServices: number;
  totalEdges: number;
  hasCycles: boolean;
  cycles: string[][];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export class ServiceDependencyMapperV3 {
  private readonly auditLog: AuditEntry[] = [];
  private adjacency: Map<string, Set<string>> = new Map();
  private services: string[] = [];

  build(input: DepInput): DepAnalysis {
    this.services = [...input.services];
    this.adjacency = new Map();
    for (const s of input.services) {
      this.adjacency.set(s, new Set());
    }
    let edgeCount = 0;
    for (const e of input.edges) {
      if (e.from === e.to) continue;
      const set = this.adjacency.get(e.from);
      if (set && this.adjacency.has(e.to)) {
        if (!set.has(e.to)) {
          set.add(e.to);
          edgeCount++;
        }
      }
    }

    const cycles = this.findCycles();
    const result: DepAnalysis = {
      totalServices: this.services.length,
      totalEdges: edgeCount,
      hasCycles: cycles.length > 0,
      cycles,
    };

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'BUILD_GRAPH',
      details: { totalServices: result.totalServices, totalEdges: result.totalEdges, hasCycles: result.hasCycles },
    });

    return result;
  }

  impactedBy(service: string): string[] {
    if (!this.adjacency.has(service)) return [];
    const visited = new Set<string>();
    const queue: string[] = [service];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbors = this.adjacency.get(cur) ?? new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    visited.delete(service);
    return [...visited].sort();
  }

  private findCycles(): string[][] {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const s of this.services) color.set(s, WHITE);

    const cycles: string[][] = [];
    const stack: string[] = [];

    const dfs = (node: string): void => {
      color.set(node, GREY);
      stack.push(node);
      const neighbors = this.adjacency.get(node) ?? new Set();
      for (const n of neighbors) {
        const c = color.get(n);
        if (c === GREY) {
          const idx = stack.indexOf(n);
          if (idx >= 0) {
            cycles.push(stack.slice(idx).concat(n));
          }
        } else if (c === WHITE) {
          dfs(n);
        }
      }
      stack.pop();
      color.set(node, BLACK);
    };

    for (const s of this.services) {
      if (color.get(s) === WHITE) dfs(s);
    }
    return cycles;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
