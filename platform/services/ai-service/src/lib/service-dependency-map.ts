// Design Ref: MTU-N123
// Plan SC: FR-N123.1~5

export interface ServiceDependencyMapConfig { enabled: boolean; namespace: string; version: string; }
export interface ServiceDependencyMapRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ServiceDependencyMapEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ServiceDependencyMapStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ServiceDependencyMap {
  private rules: ServiceDependencyMapRule[] = [];
  private events: ServiceDependencyMapEvent[] = [];
  validateConfig(c: ServiceDependencyMapConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ServiceDependencyMapRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ServiceDependencyMapEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ServiceDependencyMapEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ServiceDependencyMapStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ServiceDependencyMapEvent[] { return [...this.events]; }
}

// ============================================================================
// FR-N309.1~5: 서비스 의존성 탐색/토폴로지/순환/Blast Radius/변경 탐지
// ============================================================================

export interface TraceSample {
  source: string;
  target: string;
  protocol: 'http' | 'grpc' | 'tcp' | 'amqp';
  latencyMs: number;
  statusCode: number;
  timestamp: string;
}

export interface DependencyEdge {
  edgeId: string;
  sourceService: string;
  targetService: string;
  protocol: 'http' | 'grpc' | 'tcp' | 'amqp';
  callsPerMinute: number;
  avgLatencyMs: number;
  errorRate: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface ServiceNode {
  serviceId: string;
  name: string;
  version: string;
  status: 'healthy' | 'degraded' | 'down';
  endpoints: string[];
  metadata: Record<string, string>;
}

export interface TopologyMap {
  tenantId: string;
  nodes: ServiceNode[];
  edges: DependencyEdge[];
  generatedAt: string;
}

export interface DependencyCycle {
  services: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface BlastRadiusAnalysis {
  tenantId: string;
  impactedService: string;
  directlyAffected: string[];
  transitivelyAffected: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface DependencyChange {
  changeId: string;
  kind: 'added' | 'removed' | 'modified';
  edge: DependencyEdge;
}

function classifyCriticality(calls: number, errorRate: number): DependencyEdge['criticality'] {
  if (errorRate > 0.05 || calls > 100) return 'critical';
  if (calls > 50) return 'high';
  if (calls > 10) return 'medium';
  return 'low';
}

export function discoverDependencies(_tenantId: string, samples: TraceSample[]): DependencyEdge[] {
  const agg = new Map<string, { calls: number; totalLatency: number; errors: number; protocol: DependencyEdge['protocol'] }>();
  for (const s of samples) {
    const key = `${s.source}->${s.target}`;
    const cur = agg.get(key);
    const isErr = s.statusCode >= 500 ? 1 : 0;
    if (cur) {
      cur.calls += 1;
      cur.totalLatency += s.latencyMs;
      cur.errors += isErr;
    } else {
      agg.set(key, { calls: 1, totalLatency: s.latencyMs, errors: isErr, protocol: s.protocol });
    }
  }
  const edges: DependencyEdge[] = [];
  let idx = 0;
  for (const [key, v] of agg) {
    const parts = key.split('->');
    const source = parts[0] ?? '';
    const target = parts[1] ?? '';
    const errorRate = v.errors / v.calls;
    edges.push({
      edgeId: `edge-${idx++}`,
      sourceService: source,
      targetService: target,
      protocol: v.protocol,
      callsPerMinute: v.calls,
      avgLatencyMs: v.totalLatency / v.calls,
      errorRate,
      criticality: classifyCriticality(v.calls, errorRate),
    });
  }
  return edges;
}

export function generateTopologyMap(tenantId: string, nodes: ServiceNode[], edges: DependencyEdge[]): TopologyMap {
  return {
    tenantId,
    nodes: [...nodes],
    edges: [...edges],
    generatedAt: new Date().toISOString(),
  };
}

export function detectCircularDependencies(edges: DependencyEdge[]): DependencyCycle[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.sourceService) ?? [];
    list.push(e.targetService);
    adj.set(e.sourceService, list);
  }
  const cycles: DependencyCycle[] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(node: string): void {
    visited.add(node);
    stack.push(node);
    onStack.add(node);
    const neighbors = adj.get(node) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        dfs(n);
      } else if (onStack.has(n)) {
        const idx = stack.indexOf(n);
        if (idx >= 0) {
          const cycle = stack.slice(idx);
          cycles.push({
            services: [...cycle],
            severity: cycle.length >= 3 ? 'high' : 'medium',
          });
        }
      }
    }
    stack.pop();
    onStack.delete(node);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  return cycles;
}

export function analyzeBlastRadius(
  tenantId: string,
  impactedService: string,
  edges: DependencyEdge[],
): BlastRadiusAnalysis {
  const direct = new Set<string>();
  const transitive = new Set<string>();
  for (const e of edges) {
    if (e.targetService === impactedService) direct.add(e.sourceService);
  }
  // BFS for transitive
  const queue: string[] = [...direct];
  while (queue.length > 0) {
    const cur = queue.shift() ?? '';
    for (const e of edges) {
      if (e.targetService === cur && !direct.has(e.sourceService) && !transitive.has(e.sourceService)) {
        transitive.add(e.sourceService);
        queue.push(e.sourceService);
      }
    }
  }
  const hasCritical = edges.some((e) => e.targetService === impactedService && e.criticality === 'critical');
  const totalImpact = direct.size + transitive.size;
  let riskLevel: BlastRadiusAnalysis['riskLevel'] = 'low';
  if (hasCritical || totalImpact > 5) riskLevel = 'critical';
  else if (totalImpact > 3) riskLevel = 'high';
  else if (totalImpact > 1) riskLevel = 'medium';

  return {
    tenantId,
    impactedService,
    directlyAffected: [...direct],
    transitivelyAffected: [...transitive],
    riskLevel,
  };
}

export function detectDependencyChanges(
  _tenantId: string,
  prev: DependencyEdge[],
  curr: DependencyEdge[],
): DependencyChange[] {
  const changes: DependencyChange[] = [];
  const key = (e: DependencyEdge): string => `${e.sourceService}->${e.targetService}`;
  const prevMap = new Map(prev.map((e) => [key(e), e]));
  const currMap = new Map(curr.map((e) => [key(e), e]));
  let idx = 0;
  for (const [k, e] of currMap) {
    if (!prevMap.has(k)) {
      changes.push({ changeId: `chg-${idx++}`, kind: 'added', edge: e });
    }
  }
  for (const [k, e] of prevMap) {
    if (!currMap.has(k)) {
      changes.push({ changeId: `chg-${idx++}`, kind: 'removed', edge: e });
    }
  }
  return changes;
}
