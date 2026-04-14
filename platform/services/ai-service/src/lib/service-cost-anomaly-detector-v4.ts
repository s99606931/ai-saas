// Design Ref: §이상 — current>baseline×1.3, 비율>0.5:CRITICAL/>0.2:WARNING/NORMAL
// Plan SC: SC-R573-1, SC-R573-2, SC-R573-3

interface ServiceCostEntry {
  serviceId: string;
  currentCost: number;
  baseline: number;
  category: string;
}

interface CostAnomalyItem {
  serviceId: string;
  isAnomaly: boolean;
  overrunRate: number;
}

type OverallStatus = 'CRITICAL' | 'WARNING' | 'NORMAL';

interface CostAnomalyV4Result {
  tenantId: string;
  overallStatus: OverallStatus;
  anomalies: CostAnomalyItem[];
  anomalyCount: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  tenantId: string;
  overallStatus: OverallStatus;
  anomalyCount: number;
}

export class ServiceCostAnomalyDetectorV4 {
  private readonly auditLog: AuditEntry[] = [];

  detect(tenantId: string, services: ServiceCostEntry[]): CostAnomalyV4Result {
    const anomalies: CostAnomalyItem[] = services.map((svc) => {
      const isAnomaly = svc.currentCost > svc.baseline * 1.3;
      const overrunRate = Math.round(((svc.currentCost - svc.baseline) / svc.baseline) * 100 * 10) / 10;
      return { serviceId: svc.serviceId, isAnomaly, overrunRate };
    });

    const anomalyCount = anomalies.filter((a) => a.isAnomaly).length;
    const anomalyRatio = services.length > 0 ? anomalyCount / services.length : 0;
    const overallStatus = this.classifyStatus(anomalyRatio);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'COST_ANOMALY_DETECTED_V4',
      tenantId,
      overallStatus,
      anomalyCount,
    });

    return { tenantId, overallStatus, anomalies, anomalyCount };
  }

  private classifyStatus(ratio: number): OverallStatus {
    if (ratio > 0.5) return 'CRITICAL';
    if (ratio > 0.2) return 'WARNING';
    return 'NORMAL';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
