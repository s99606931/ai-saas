// Design Ref: §핵심 알고리즘 — 백분위 통계 + SLA 위반 탐지 + 최적화 권고
// Plan SC: FR-R217.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface EndpointProfile {
  path: string;
  method: string;
  slaMs: number;
}

interface CallRecord {
  path: string;
  method: string;
  durationMs: number;
  timestamp: string;
}

interface EndpointStats {
  path: string;
  method: string;
  slaMs: number;
  count: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
}

interface SlaViolation {
  path: string;
  method: string;
  p95Ms: number;
  slaMs: number;
  violationPercent: number;
}

interface Recommendation {
  path: string;
  method: string;
  type: 'caching' | 'batching' | 'splitting';
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R217.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

export class ApiPerformanceOptimizerAI {
  private endpoints = new Map<string, EndpointProfile>();
  private calls: CallRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private endpointKey(path: string, method: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R217.1
  registerEndpoint(path: string, method: string, slaMs: number): void {
    this.endpoints.set(this.endpointKey(path, method), { path, method, slaMs });
    this.log('REGISTER_ENDPOINT', { path, method, slaMs });
  }

  // Plan SC: FR-R217.2
  recordCall(path: string, method: string, durationMs: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    this.calls.push({ path, method, durationMs, timestamp: new Date().toISOString() });
    this.log('RECORD_CALL', { path, method, durationMs });
  }

  // Plan SC: FR-R217.3
  getStats(path: string, method: string): EndpointStats | null {
    const endpoint = this.endpoints.get(this.endpointKey(path, method));
    if (!endpoint) return null;

    const durations = this.calls
      .filter(c => c.path === path && c.method.toUpperCase() === method.toUpperCase())
      .map(c => c.durationMs)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return { path, method, slaMs: endpoint.slaMs, count: 0, avgMs: 0, p95Ms: 0, p99Ms: 0 };
    }

    const avgMs = Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
    const p95Ms = percentile(durations, 0.95);
    const p99Ms = percentile(durations, 0.99);

    return { path, method, slaMs: endpoint.slaMs, count: durations.length, avgMs, p95Ms, p99Ms };
  }

  // Plan SC: FR-R217.4
  detectSlaViolations(): SlaViolation[] {
    const violations: SlaViolation[] = [];

    for (const endpoint of this.endpoints.values()) {
      const stats = this.getStats(endpoint.path, endpoint.method);
      if (!stats || stats.count === 0) continue;

      if (stats.p95Ms > endpoint.slaMs) {
        const violationPercent = Math.round(((stats.p95Ms - endpoint.slaMs) / endpoint.slaMs) * 100);
        violations.push({
          path: endpoint.path,
          method: endpoint.method,
          p95Ms: stats.p95Ms,
          slaMs: endpoint.slaMs,
          violationPercent,
        });
      }
    }

    this.log('DETECT_SLA_VIOLATIONS', { count: violations.length });
    return violations;
  }

  getOptimizationRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const endpoint of this.endpoints.values()) {
      const stats = this.getStats(endpoint.path, endpoint.method);
      if (!stats || stats.count === 0) continue;

      if (stats.avgMs > endpoint.slaMs * 0.8) {
        recommendations.push({
          path: endpoint.path,
          method: endpoint.method,
          type: 'caching',
          reason: `평균 응답시간(${stats.avgMs}ms)이 SLA의 80%를 초과합니다`,
        });
      } else if (stats.p99Ms > endpoint.slaMs * 2) {
        recommendations.push({
          path: endpoint.path,
          method: endpoint.method,
          type: 'batching',
          reason: `p99 응답시간(${stats.p99Ms}ms)이 SLA의 2배를 초과합니다`,
        });
      }
    }

    return recommendations;
  }

  // Plan SC: FR-R217.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
