// Design Ref: §이상분류 — cpu>95:CPU_SPIKE/egress>100:DATA_EXFIL/access>50:INTRUSION/NORMAL
// Plan SC: SC-R608-1, SC-R608-2, SC-R608-3

interface CloudResource {
  resourceId: string;
  type: string;
  cpuUsage: number;
  networkEgressGB: number;
  unusualAccessCount: number;
}

type AnomalyType = 'CPU_SPIKE' | 'DATA_EXFIL' | 'INTRUSION' | 'NORMAL';
type ResourceSeverity = 'CRITICAL' | 'HIGH' | 'OK';

interface ResourceDetail {
  resourceId: string;
  anomalyType: AnomalyType;
  severity: ResourceSeverity;
}

interface ResourceAnomalyResult {
  accountId: string;
  requiresImmediateAction: boolean;
  resources: ResourceDetail[];
  criticalCount: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  accountId: string;
  criticalCount: number;
  requiresImmediateAction: boolean;
}

export class CloudResourceAnomalyDetectorV2 {
  private readonly auditLog: AuditEntry[] = [];

  detect(accountId: string, resources: CloudResource[]): ResourceAnomalyResult {
    const details: ResourceDetail[] = resources.map((r) => {
      const anomalyType = this.classifyAnomaly(r);
      return { resourceId: r.resourceId, anomalyType, severity: this.classifySeverity(anomalyType) };
    });

    const criticalCount = details.filter((d) => d.severity === 'CRITICAL').length;
    const requiresImmediateAction = criticalCount > 0;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CLOUD_RESOURCE_ANOMALY_DETECTED',
      accountId,
      criticalCount,
      requiresImmediateAction,
    });

    return { accountId, requiresImmediateAction, resources: details, criticalCount };
  }

  private classifyAnomaly(r: CloudResource): AnomalyType {
    // 우선순위: DATA_EXFIL > INTRUSION > CPU_SPIKE
    if (r.networkEgressGB > 100) return 'DATA_EXFIL';
    if (r.unusualAccessCount > 50) return 'INTRUSION';
    if (r.cpuUsage > 95) return 'CPU_SPIKE';
    return 'NORMAL';
  }

  private classifySeverity(anomalyType: AnomalyType): ResourceSeverity {
    if (anomalyType === 'DATA_EXFIL' || anomalyType === 'INTRUSION') return 'CRITICAL';
    if (anomalyType === 'CPU_SPIKE') return 'HIGH';
    return 'OK';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
