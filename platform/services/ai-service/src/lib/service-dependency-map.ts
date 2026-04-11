// 서비스 의존성 맵 자동 생성 -- FR-N309.1~FR-N309.6
// Design Ref: MTU-N309 DESIGN §1~§6
// Plan SC: SC-1 (탐지율 95%+), SC-2 (순환 100%), SC-3 (업데이트 5분), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안, D-13 변경관리

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 서비스 노드 */
export interface ServiceNode {
  readonly serviceId: string;
  readonly name: string;
  readonly version: string;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly endpoints: string[];
  readonly metadata: Record<string, unknown>;
}

/** 의존성 엣지 */
export interface DependencyEdge {
  readonly edgeId: string;
  readonly sourceService: string;
  readonly targetService: string;
  readonly protocol: 'http' | 'grpc' | 'amqp' | 'tcp' | 'websocket';
  readonly callsPerMinute: number;
  readonly avgLatencyMs: number;
  readonly errorRate: number;
  readonly criticality: 'critical' | 'high' | 'medium' | 'low';
}

/** 토폴로지 맵 */
export interface TopologyMap {
  readonly mapId: string;
  readonly tenantId: string;
  readonly nodes: ServiceNode[];
  readonly edges: DependencyEdge[];
  readonly generatedAt: string;
}

/** 순환 의존성 */
export interface CircularDependency {
  readonly cycleId: string;
  readonly services: string[];
  readonly severity: 'critical' | 'warning';
  readonly description: string;
}

/** 변경 영향 분석 */
export interface BlastRadiusAnalysis {
  readonly analysisId: string;
  readonly targetService: string;
  readonly directlyAffected: string[];
  readonly indirectlyAffected: string[];
  readonly totalAffected: number;
  readonly riskLevel: 'critical' | 'high' | 'medium' | 'low';
  readonly analyzedAt: string;
}

/** 의존성 변경 알림 */
export interface DependencyChange {
  readonly changeId: string;
  readonly tenantId: string;
  readonly changeType: 'added' | 'removed' | 'modified';
  readonly sourceService: string;
  readonly targetService: string;
  readonly description: string;
  readonly detectedAt: string;
}

/** 감사 로그 */
export interface DependencyAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: DependencyAuditEntry[] = [];

function recordAudit(entry: Omit<DependencyAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getDependencyAuditLog(tenantId: string): readonly DependencyAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 호출 관계 탐지 ──────────────────────────────────────────────────────────

/** 트래픽 로그 */
export interface TrafficLog {
  readonly source: string;
  readonly target: string;
  readonly protocol: DependencyEdge['protocol'];
  readonly latencyMs: number;
  readonly statusCode: number;
  readonly timestamp: string;
}

/** 서비스 간 호출 관계 자동 탐지 -- FR-N309.1 */
export function discoverDependencies(
  tenantId: string,
  trafficLogs: TrafficLog[],
): DependencyEdge[] {
  const edgeMap = new Map<string, {
    calls: number;
    totalLatency: number;
    errors: number;
    protocol: DependencyEdge['protocol'];
  }>();

  for (const log of trafficLogs) {
    const key = `${log.source}->${log.target}`;
    const existing = edgeMap.get(key) ?? { calls: 0, totalLatency: 0, errors: 0, protocol: log.protocol };
    existing.calls++;
    existing.totalLatency += log.latencyMs;
    if (log.statusCode >= 400) existing.errors++;
    edgeMap.set(key, existing);
  }

  const edges: DependencyEdge[] = [];
  for (const [key, data] of edgeMap.entries()) {
    const parts = key.split('->');
    const source = parts[0] ?? 'unknown';
    const target = parts[1] ?? 'unknown';

    const avgLatency = data.calls > 0 ? data.totalLatency / data.calls : 0;
    const errorRate = data.calls > 0 ? data.errors / data.calls : 0;

    let criticality: DependencyEdge['criticality'] = 'low';
    if (data.calls > 100) criticality = 'critical';
    else if (data.calls > 50) criticality = 'high';
    else if (data.calls > 10) criticality = 'medium';

    edges.push({
      edgeId: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceService: source,
      targetService: target,
      protocol: data.protocol,
      callsPerMinute: data.calls,
      avgLatencyMs: avgLatency,
      errorRate,
      criticality,
    });
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'DEPENDENCIES_DISCOVERED',
    target: tenantId,
    details: { logsAnalyzed: trafficLogs.length, edgesFound: edges.length },
  });

  return edges;
}

// -- 토폴로지 맵 생성 ────────────────────────────────────────────────────────

const mapStore: Map<string, TopologyMap> = new Map();

/** 의존성 토폴로지 맵 생성 -- FR-N309.2 */
export function generateTopologyMap(
  tenantId: string,
  services: ServiceNode[],
  edges: DependencyEdge[],
): TopologyMap {
  const map: TopologyMap = {
    mapId: `topo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    nodes: services,
    edges,
    generatedAt: new Date().toISOString(),
  };

  mapStore.set(tenantId, map);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'TOPOLOGY_MAP_GENERATED',
    target: map.mapId,
    details: { nodesCount: services.length, edgesCount: edges.length },
  });

  return map;
}

/** 토폴로지 맵 조회 */
export function getTopologyMap(tenantId: string): TopologyMap | null {
  return mapStore.get(tenantId) ?? null;
}

// -- 순환 의존성 탐지 ────────────────────────────────────────────────────────

/** 순환 의존성 탐지 -- FR-N309.3 */
export function detectCircularDependencies(edges: DependencyEdge[]): CircularDependency[] {
  const graph = new Map<string, string[]>();

  for (const edge of edges) {
    const existing = graph.get(edge.sourceService) ?? [];
    existing.push(edge.targetService);
    graph.set(edge.sourceService, existing);
  }

  const cycles: CircularDependency[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        const cycle = path.slice(cycleStart);
        cycle.push(node);
        cycles.push({
          cycleId: `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          services: cycle,
          severity: cycle.length <= 3 ? 'critical' : 'warning',
          description: `순환 의존성: ${cycle.join(' -> ')}`,
        });
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, node]);
    }

    stack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  return cycles;
}

// -- 변경 영향 분석 ──────────────────────────────────────────────────────────

/** 변경 영향 분석 (blast radius) -- FR-N309.4 */
export function analyzeBlastRadius(
  tenantId: string,
  targetService: string,
  edges: DependencyEdge[],
): BlastRadiusAnalysis {
  // 직접 영향: targetService에 의존하는 서비스
  const directlyAffected = edges
    .filter(e => e.targetService === targetService)
    .map(e => e.sourceService);

  // 간접 영향: 직접 영향 서비스에 의존하는 서비스
  const indirectlyAffected: string[] = [];
  for (const affected of directlyAffected) {
    const indirect = edges
      .filter(e => e.targetService === affected)
      .map(e => e.sourceService)
      .filter(s => !directlyAffected.includes(s) && s !== targetService);
    indirectlyAffected.push(...indirect);
  }

  const uniqueIndirect = [...new Set(indirectlyAffected)];
  const totalAffected = directlyAffected.length + uniqueIndirect.length;

  let riskLevel: BlastRadiusAnalysis['riskLevel'] = 'low';
  if (totalAffected >= 5) riskLevel = 'critical';
  else if (totalAffected >= 3) riskLevel = 'high';
  else if (totalAffected >= 1) riskLevel = 'medium';

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'BLAST_RADIUS_ANALYZED',
    target: targetService,
    details: { directlyAffected: directlyAffected.length, indirectlyAffected: uniqueIndirect.length, riskLevel },
  });

  return {
    analysisId: `blast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetService,
    directlyAffected,
    indirectlyAffected: uniqueIndirect,
    totalAffected,
    riskLevel,
    analyzedAt: new Date().toISOString(),
  };
}

// -- 변경 알림 ────────────────────────────────────────────────────────────────

const changeStore: DependencyChange[] = [];

/** 의존성 변경 탐지 및 알림 -- FR-N309.5 */
export function detectDependencyChanges(
  tenantId: string,
  previousEdges: DependencyEdge[],
  currentEdges: DependencyEdge[],
): DependencyChange[] {
  const changes: DependencyChange[] = [];
  const prevKeys = new Set(previousEdges.map(e => `${e.sourceService}->${e.targetService}`));
  const currKeys = new Set(currentEdges.map(e => `${e.sourceService}->${e.targetService}`));

  // 추가된 의존성
  for (const key of currKeys) {
    if (!prevKeys.has(key)) {
      const parts = key.split('->');
      changes.push({
        changeId: `change-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        changeType: 'added',
        sourceService: parts[0] ?? 'unknown',
        targetService: parts[1] ?? 'unknown',
        description: `새로운 의존성 추가: ${key}`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 제거된 의존성
  for (const key of prevKeys) {
    if (!currKeys.has(key)) {
      const parts = key.split('->');
      changes.push({
        changeId: `change-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        changeType: 'removed',
        sourceService: parts[0] ?? 'unknown',
        targetService: parts[1] ?? 'unknown',
        description: `의존성 제거: ${key}`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  changeStore.push(...changes);

  if (changes.length > 0) {
    recordAudit({
      actor: 'system',
      tenantId,
      action: 'DEPENDENCY_CHANGES_DETECTED',
      target: tenantId,
      details: { added: changes.filter(c => c.changeType === 'added').length, removed: changes.filter(c => c.changeType === 'removed').length },
    });
  }

  return changes;
}

/** 서비스 의존성 맵 서비스 */
export class ServiceDependencyMapService {
  constructor(private readonly tenantId: string) {}

  discover(trafficLogs: TrafficLog[]): DependencyEdge[] {
    return discoverDependencies(this.tenantId, trafficLogs);
  }

  generateMap(services: ServiceNode[], edges: DependencyEdge[]): TopologyMap {
    return generateTopologyMap(this.tenantId, services, edges);
  }

  getMap(): TopologyMap | null {
    return getTopologyMap(this.tenantId);
  }

  detectCycles(edges: DependencyEdge[]): CircularDependency[] {
    return detectCircularDependencies(edges);
  }

  analyzeBlastRadius(target: string, edges: DependencyEdge[]): BlastRadiusAnalysis {
    return analyzeBlastRadius(this.tenantId, target, edges);
  }

  detectChanges(prev: DependencyEdge[], curr: DependencyEdge[]): DependencyChange[] {
    return detectDependencyChanges(this.tenantId, prev, curr);
  }

  getAuditLog(): readonly DependencyAuditEntry[] {
    return getDependencyAuditLog(this.tenantId);
  }
}
