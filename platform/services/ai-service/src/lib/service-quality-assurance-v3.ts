// Design Ref: §SLA위반 — 3개:CRITICAL/2개:HIGH/1개:MEDIUM/0개:OK, 에스컬레이션: CRITICAL||HIGH
// Plan SC: SC-R606-1, SC-R606-2, SC-R606-3

interface QualityAssuranceInput {
  serviceId: string;
  availability: number;
  responseTimeMs: number;
  errorRate: number;
  slaAvailability: number;
  slaResponseTimeMs: number;
  slaErrorRate: number;
}

type QASeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK';

interface ViolationEntry {
  metric: string;
  actual: number;
  sla: number;
}

interface QualityAssuranceResult {
  serviceId: string;
  violationCount: number;
  severity: QASeverity;
  requiresEscalation: boolean;
  violations: ViolationEntry[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  serviceId: string;
  severity: QASeverity;
  violationCount: number;
}

export class ServiceQualityAssuranceV3 {
  private readonly auditLog: AuditEntry[] = [];

  assess(input: QualityAssuranceInput): QualityAssuranceResult {
    const { serviceId, availability, responseTimeMs, errorRate, slaAvailability, slaResponseTimeMs, slaErrorRate } = input;

    const violations: ViolationEntry[] = [];
    if (availability < slaAvailability) violations.push({ metric: 'availability', actual: availability, sla: slaAvailability });
    if (responseTimeMs > slaResponseTimeMs) violations.push({ metric: 'responseTimeMs', actual: responseTimeMs, sla: slaResponseTimeMs });
    if (errorRate > slaErrorRate) violations.push({ metric: 'errorRate', actual: errorRate, sla: slaErrorRate });

    const severity = this.classifySeverity(violations.length);
    const requiresEscalation = severity === 'CRITICAL' || severity === 'HIGH';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SLA_ASSESSED',
      serviceId,
      severity,
      violationCount: violations.length,
    });

    return { serviceId, violationCount: violations.length, severity, requiresEscalation, violations };
  }

  private classifySeverity(count: number): QASeverity {
    if (count >= 3) return 'CRITICAL';
    if (count === 2) return 'HIGH';
    if (count === 1) return 'MEDIUM';
    return 'OK';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
