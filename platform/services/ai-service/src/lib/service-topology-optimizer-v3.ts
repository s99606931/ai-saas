// Design Ref: SVC-AI-ADV-R684.design.md — AI기반 서비스 토폴로지 최적화 v3
// Plan SC: FR-R684.1~5

export type EdgeStatus = 'HOTSPOT' | 'NORMAL';
export type EdgeRecommendation = 'SCALE' | 'CACHE' | 'MONITOR';

export interface ServiceEdge {
  from: string;
  to: string;
  avgLatencyMs: number;
  rpm: number;
}

export interface EdgeAnalysis {
  from: string;
  to: string;
  load: number;
  status: EdgeStatus;
  recommendation: EdgeRecommendation;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

export class ServiceTopologyOptimizerV3 {
  private readonly edges: ServiceEdge[] = [];
  private readonly auditLog: AuditEntry[] = [];

  addEdge(edge: ServiceEdge): void {
    if (edge.avgLatencyMs < 0 || edge.rpm < 0) {
      throw new Error('INVALID_EDGE_METRIC');
    }
    this.edges.push(edge);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_EDGE',
      details: { from: edge.from, to: edge.to, latency: edge.avgLatencyMs, rpm: edge.rpm },
    });
  }

  analyze(dataGrade?: string): EdgeAnalysis[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (this.edges.length === 0) {
      return [];
    }

    const loads = this.edges.map((e) => (e.avgLatencyMs * e.rpm) / 1000);
    const sorted = [...loads].sort((a, b) => b - a);
    const cutoffIdx = Math.max(0, Math.floor(sorted.length * 0.2) - 1);
    const hotspotThreshold = sorted[cutoffIdx] ?? sorted[0]!;

    const results: EdgeAnalysis[] = this.edges.map((edge, i) => {
      const load = Number((loads[i]! ?? 0).toFixed(4));
      const status: EdgeStatus = load >= hotspotThreshold && load > 0 ? 'HOTSPOT' : 'NORMAL';
      let recommendation: EdgeRecommendation;
      if (status === 'HOTSPOT') {
        recommendation = 'SCALE';
      } else if (edge.avgLatencyMs > 500) {
        recommendation = 'CACHE';
      } else {
        recommendation = 'MONITOR';
      }
      return { from: edge.from, to: edge.to, load, status, recommendation };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE',
      details: { edgeCount: this.edges.length, hotspots: results.filter((r) => r.status === 'HOTSPOT').length },
    });
    return results;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
