// Design Ref: SVC-AI-ADV-R677.design.md — AI기반 서비스 메시 관찰가능성 v3
// Plan SC: FR-R677.1~5

export type MeshHealth = 'CRITICAL' | 'WARNING' | 'HEALTHY';
export type MeshAction = 'OBSERVE' | 'INVESTIGATE' | 'PAGE';

interface MeshService { serviceId: string; name: string; sloMs: number }
interface MeshMetric {
  metricId: string;
  serviceId: string;
  latencyMs: number;
  errorRate: number;
}
interface MeshFinding {
  metricId: string;
  serviceId: string;
  health: MeshHealth;
  action: MeshAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: MeshAction[] = ['OBSERVE', 'INVESTIGATE', 'PAGE'];

function rankToAction(rank: number): MeshAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class ServiceMeshObservabilityAIV3 {
  private services = new Map<string, MeshService>();
  private findings: MeshFinding[] = [];
  private auditLog: AuditEntry[] = [];

  registerService(svc: MeshService): void {
    if (svc.sloMs <= 0) {
      throw new Error('INVALID_SLO');
    }
    this.services.set(svc.serviceId, svc);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      details: { serviceId: svc.serviceId, name: svc.name, sloMs: svc.sloMs },
    });
  }

  ingestMetric(metric: MeshMetric, dataGrade?: string): MeshFinding {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const svc = this.services.get(metric.serviceId);
    if (!svc) {
      throw new Error(`UNKNOWN_SERVICE: ${metric.serviceId}`);
    }
    if (metric.latencyMs < 0 || metric.errorRate < 0 || metric.errorRate > 1) {
      throw new Error('INVALID_METRIC');
    }

    const ratio = metric.latencyMs / svc.sloMs;
    let health: MeshHealth;
    let baseRank: number;
    if (ratio >= 3.0) {
      health = 'CRITICAL';
      baseRank = 2;
    } else if (ratio >= 1.5) {
      health = 'WARNING';
      baseRank = 1;
    } else {
      health = 'HEALTHY';
      baseRank = 0;
    }

    const finalRank = metric.errorRate >= 0.05 ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const finding: MeshFinding = {
      metricId: metric.metricId,
      serviceId: metric.serviceId,
      health,
      action,
    };
    this.findings.push(finding);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INGEST_METRIC',
      details: { metricId: metric.metricId, serviceId: metric.serviceId, health, action },
    });
    return finding;
  }

  getPagingFindings(): MeshFinding[] {
    return this.findings.filter((f) => f.action === 'PAGE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
