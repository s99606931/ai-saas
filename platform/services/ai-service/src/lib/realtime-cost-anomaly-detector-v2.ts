// Design Ref: §이상탐지 — actual>budget×1.2||actual>prevMonth×1.5
// Plan SC: SC-R541-1, SC-R541-2, SC-R541-3

interface CostInput {
  serviceId: string;
  date: string;
  actualCost: number;
  budgetedCost: number;
  prevMonthCost: number;
}

type CostSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';

interface CostAnomalyResult {
  serviceId: string;
  date: string;
  isAnomaly: boolean;
  severity: CostSeverity;
  overrunRate: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  serviceId: string;
  isAnomaly: boolean;
  severity: CostSeverity;
}

export class RealtimeCostAnomalyDetectorV2 {
  private readonly auditLog: AuditEntry[] = [];

  detect(input: CostInput): CostAnomalyResult {
    const { serviceId, date, actualCost, budgetedCost, prevMonthCost } = input;

    const isAnomaly = actualCost > budgetedCost * 1.2 || actualCost > prevMonthCost * 1.5;
    const severity = this.classifySeverity(actualCost, budgetedCost);
    const overrunRate = Math.round(((actualCost - budgetedCost) / budgetedCost) * 100 * 100) / 100;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'COST_ANOMALY_DETECTED',
      serviceId,
      isAnomaly,
      severity,
    });

    return { serviceId, date, isAnomaly, severity, overrunRate };
  }

  private classifySeverity(actualCost: number, budgetedCost: number): CostSeverity {
    if (actualCost > budgetedCost * 2) return 'CRITICAL';
    if (actualCost > budgetedCost * 1.5) return 'HIGH';
    if (actualCost > budgetedCost * 1.2) return 'MEDIUM';
    return 'NORMAL';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
