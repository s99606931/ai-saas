// Design Ref: §SVC-AI-ADV-R478 — AI기반 자동 API 성능 최적화 v3
// Plan SC: FR-R478.1~5

export type ApiStatus = 'CRITICAL' | 'WARNING' | 'HEALTHY';
export type Recommendation = 'CACHE' | 'RATE_LIMIT' | 'NONE';

export interface ApiMetric {
  readonly apiId: string;
  readonly avgResponseMs: number;
  readonly p99ResponseMs: number;
  readonly errorRate: number;
  readonly callsPerMin: number;
}

export interface ApiOptimizationResult {
  readonly apiId: string;
  readonly status: ApiStatus;
  readonly score: number;
  readonly recommendations: readonly Recommendation[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ApiPerformanceOptimizerV3 {
  private readonly auditLog: AuditEvent[] = [];

  private classifyStatus(p99: number, errorRate: number): ApiStatus {
    if (p99 > 2000 || errorRate > 0.05) return 'CRITICAL';
    if (p99 > 1000 || errorRate > 0.01) return 'WARNING';
    return 'HEALTHY';
  }

  private computeScore(p99: number, errorRate: number): number {
    return Math.max(0, 100 - Math.min(p99 / 20, 50) - Math.min(errorRate * 1000, 50));
  }

  private getRecommendations(status: ApiStatus): readonly Recommendation[] {
    if (status === 'CRITICAL') return ['CACHE', 'RATE_LIMIT'];
    if (status === 'WARNING') return ['CACHE'];
    return [];
  }

  optimize(metrics: readonly ApiMetric[]): readonly ApiOptimizationResult[] {
    const results: ApiOptimizationResult[] = metrics.map(m => {
      const status = this.classifyStatus(m.p99ResponseMs, m.errorRate);
      const score = Math.round(this.computeScore(m.p99ResponseMs, m.errorRate) * 10) / 10;
      const recommendations = this.getRecommendations(status);
      return { apiId: m.apiId, status, score, recommendations };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'api.optimize',
      details: {
        apiCount: metrics.length,
        criticalCount: results.filter(r => r.status === 'CRITICAL').length,
        warningCount: results.filter(r => r.status === 'WARNING').length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
