// Design Ref: SVC-AI-ADV-R700.design.md — AI기반 서비스 메시 최적화 v4
// Plan SC: FR-R700.1~5

import { createHash } from 'crypto';

export type MeshHealth = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
export type MeshAction = 'KEEP' | 'REROUTE' | 'QUARANTINE';

interface ServiceSpec {
  serviceId: string;
  targetLatencyMs: number;
  sloErrorRate: number;
}
interface Telemetry { latencyMs: number; errorRate: number }
interface MeshVerdict {
  maskedServiceId: string;
  health: MeshHealth;
  action: MeshAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class AIServiceMeshOptimizerV4 {
  private services = new Map<string, ServiceSpec>();
  private verdicts: MeshVerdict[] = [];
  private auditLog: AuditEntry[] = [];

  registerService(spec: ServiceSpec): void {
    if (spec.targetLatencyMs <= 0) throw new Error('INVALID_TARGET');
    if (spec.sloErrorRate < 0 || spec.sloErrorRate > 1) throw new Error('INVALID_SLO');
    this.services.set(spec.serviceId, spec);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_SERVICE',
      details: { maskedServiceId: maskId(spec.serviceId), targetLatencyMs: spec.targetLatencyMs, sloErrorRate: spec.sloErrorRate },
    });
  }

  recordTelemetry(serviceId: string, telemetry: Telemetry, dataGrade?: string): MeshVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const spec = this.services.get(serviceId);
    if (!spec) throw new Error(`UNKNOWN_SERVICE: ${serviceId}`);
    if (telemetry.latencyMs < 0) throw new Error('INVALID_LATENCY');
    if (telemetry.errorRate < 0 || telemetry.errorRate > 1) throw new Error('INVALID_ERROR_RATE');

    let health: MeshHealth;
    if (telemetry.latencyMs <= spec.targetLatencyMs && telemetry.errorRate <= spec.sloErrorRate) {
      health = 'HEALTHY';
    } else if (telemetry.latencyMs <= spec.targetLatencyMs * 2 && telemetry.errorRate <= spec.sloErrorRate * 2) {
      health = 'DEGRADED';
    } else {
      health = 'CRITICAL';
    }

    const action: MeshAction = health === 'HEALTHY' ? 'KEEP' : health === 'DEGRADED' ? 'REROUTE' : 'QUARANTINE';
    const maskedServiceId = maskId(serviceId);
    const verdict: MeshVerdict = { maskedServiceId, health, action };
    this.verdicts.push(verdict);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_TELEMETRY',
      details: { maskedServiceId, health, action, latencyMs: telemetry.latencyMs, errorRate: telemetry.errorRate },
    });
    return verdict;
  }

  getQuarantined(): MeshVerdict[] {
    return this.verdicts.filter((v) => v.action === 'QUARANTINE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
