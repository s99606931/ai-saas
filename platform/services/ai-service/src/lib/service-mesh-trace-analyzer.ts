// 서비스 메시 트레이스 분석기 -- FR-N371.1~FR-N371.5
// Design Ref: MTU-N371 | CSAP: D-06, D-08

export interface OtelSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly serviceName: string;
  readonly operationName: string;
  readonly startTimeNs: number;
  readonly durationNs: number;
  readonly status: 'ok' | 'error';
  readonly attributes?: Record<string, string | number>;
}

export interface ServiceEdge {
  readonly from: string;
  readonly to: string;
  readonly callCount: number;
  readonly errorCount: number;
}

export interface ServiceGraph {
  readonly services: readonly string[];
  readonly edges: readonly ServiceEdge[];
}

export interface LatencyStats {
  readonly service: string;
  readonly operation: string;
  readonly count: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly errorRate: number;
}

export interface Bottleneck {
  readonly service: string;
  readonly operation: string;
  readonly p95Ms: number;
  readonly reason: string;
}

export interface MeshAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: MeshAuditEntry[] = [];

function recordAudit(entry: Omit<MeshAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getMeshAuditLog(tenantId: string): readonly MeshAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function buildServiceGraph(spans: readonly OtelSpan[]): ServiceGraph {
  const services = new Set<string>();
  const edgeMap = new Map<string, { count: number; err: number }>();
  const byId = new Map<string, OtelSpan>();
  for (const s of spans) {
    services.add(s.serviceName);
    byId.set(s.spanId, s);
  }
  for (const s of spans) {
    if (s.parentSpanId) {
      const parent = byId.get(s.parentSpanId);
      if (parent && parent.serviceName !== s.serviceName) {
        const key = `${parent.serviceName}->${s.serviceName}`;
        const cur = edgeMap.get(key) ?? { count: 0, err: 0 };
        cur.count += 1;
        if (s.status === 'error') cur.err += 1;
        edgeMap.set(key, cur);
      }
    }
  }
  const edges: ServiceEdge[] = [];
  for (const [key, v] of edgeMap.entries()) {
    const [from, to] = key.split('->');
    edges.push({ from: from ?? '', to: to ?? '', callCount: v.count, errorCount: v.err });
  }
  return { services: Array.from(services).sort(), edges };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export function computeLatencyStats(spans: readonly OtelSpan[]): readonly LatencyStats[] {
  const groups = new Map<string, OtelSpan[]>();
  for (const s of spans) {
    const key = `${s.serviceName}::${s.operationName}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const result: LatencyStats[] = [];
  for (const [key, arr] of groups.entries()) {
    const [svc, op] = key.split('::');
    const durationsMs = arr.map((s) => s.durationNs / 1_000_000).sort((a, b) => a - b);
    const errors = arr.filter((s) => s.status === 'error').length;
    result.push({
      service: svc ?? '',
      operation: op ?? '',
      count: arr.length,
      p50Ms: percentile(durationsMs, 50),
      p95Ms: percentile(durationsMs, 95),
      p99Ms: percentile(durationsMs, 99),
      errorRate: arr.length > 0 ? errors / arr.length : 0,
    });
  }
  return result;
}

export function detectBottlenecks(
  stats: readonly LatencyStats[],
  p95ThresholdMs: number,
  errorThreshold: number,
): readonly Bottleneck[] {
  const out: Bottleneck[] = [];
  for (const s of stats) {
    if (s.p95Ms > p95ThresholdMs) {
      out.push({ service: s.service, operation: s.operation, p95Ms: s.p95Ms, reason: `p95 ${s.p95Ms.toFixed(1)}ms > ${p95ThresholdMs}ms` });
    } else if (s.errorRate > errorThreshold) {
      out.push({ service: s.service, operation: s.operation, p95Ms: s.p95Ms, reason: `errorRate ${(s.errorRate * 100).toFixed(1)}% > ${(errorThreshold * 100).toFixed(1)}%` });
    }
  }
  return out;
}

export function analyzeTrace(
  tenantId: string,
  spans: readonly OtelSpan[],
  p95ThresholdMs = 500,
  errorThreshold = 0.05,
): { graph: ServiceGraph; stats: readonly LatencyStats[]; bottlenecks: readonly Bottleneck[] } {
  const graph = buildServiceGraph(spans);
  const stats = computeLatencyStats(spans);
  const bottlenecks = detectBottlenecks(stats, p95ThresholdMs, errorThreshold);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'MESH_TRACE_ANALYZED',
    target: tenantId,
    details: { spanCount: spans.length, services: graph.services.length, bottlenecks: bottlenecks.length },
  });
  return { graph, stats, bottlenecks };
}

export class ServiceMeshTraceAnalyzerService {
  constructor(private readonly tenantId: string) {}
  buildGraph(spans: readonly OtelSpan[]): ServiceGraph {
    return buildServiceGraph(spans);
  }
  analyze(spans: readonly OtelSpan[], p95Threshold = 500, errorThreshold = 0.05) {
    return analyzeTrace(this.tenantId, spans, p95Threshold, errorThreshold);
  }
  getAuditLog(): readonly MeshAuditEntry[] {
    return getMeshAuditLog(this.tenantId);
  }
}
