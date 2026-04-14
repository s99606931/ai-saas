// Design Ref: SVC-AI-ADV-R692.design.md — AI기반 공공 인프라 모니터링 v3
// Plan SC: FR-R692.1~5

import { createHash } from 'crypto';

export type InfraStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface InfraAsset {
  assetId: string;
  category: string;
  criticality: number;
}
interface InfraMetric {
  assetId: string;
  operatorId: string;
  utilization: number;
  errorRate: number;
}
interface InfraVerdict {
  assetId: string;
  health: number;
  status: InfraStatus;
  maskedOperatorId: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class PublicInfrastructureMonitorAIV3 {
  private assets = new Map<string, InfraAsset>();
  private verdicts: InfraVerdict[] = [];
  private auditLog: AuditEntry[] = [];

  registerAsset(asset: InfraAsset): void {
    if (asset.criticality < 1 || asset.criticality > 3) {
      throw new Error('INVALID_CRITICALITY');
    }
    this.assets.set(asset.assetId, asset);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ASSET',
      details: { assetId: asset.assetId, category: asset.category },
    });
  }

  ingestMetric(metric: InfraMetric, dataGrade?: string): InfraVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!this.assets.has(metric.assetId)) {
      throw new Error(`UNKNOWN_ASSET: ${metric.assetId}`);
    }
    if (metric.utilization < 0 || metric.errorRate < 0) {
      throw new Error('INVALID_METRIC');
    }

    const health = Math.max(0, 100 - metric.utilization - metric.errorRate * 2);
    let status: InfraStatus;
    if (health < 40) status = 'CRITICAL';
    else if (health < 70) status = 'DEGRADED';
    else status = 'HEALTHY';

    const maskedOperatorId = maskPII(metric.operatorId);
    const verdict: InfraVerdict = {
      assetId: metric.assetId,
      health,
      status,
      maskedOperatorId,
    };
    this.verdicts.push(verdict);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INGEST_METRIC',
      details: { assetId: metric.assetId, health, status, maskedOperatorId },
    });
    return verdict;
  }

  getCritical(): InfraVerdict[] {
    return this.verdicts.filter((v) => v.status === 'CRITICAL');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
