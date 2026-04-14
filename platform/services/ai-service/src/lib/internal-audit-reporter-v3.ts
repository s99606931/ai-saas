// Design Ref: §가중심각도 — isRecurring: LOW→MEDIUM/MEDIUM→HIGH/HIGH→CRITICAL/CRITICAL유지
// Plan SC: SC-R605-1, SC-R605-2, SC-R605-3

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface AuditFinding {
  findingId: string;
  category: string;
  severity: Severity;
  isRecurring: boolean;
}

interface FindingDetail {
  findingId: string;
  weightedSeverity: Severity;
  requiresImmediate: boolean;
}

interface AuditReportResult {
  auditId: string;
  agencyId: string;
  auditScore: number;
  immediateCount: number;
  findings: FindingDetail[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  auditId: string;
  auditScore: number;
  immediateCount: number;
}

const SEVERITY_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class InternalAuditReporterV3 {
  private readonly auditLog: AuditEntry[] = [];

  report(auditId: string, agencyId: string, findings: AuditFinding[]): AuditReportResult {
    const details: FindingDetail[] = findings.map((f) => {
      const weightedSeverity = f.isRecurring ? this.escalate(f.severity) : f.severity;
      return {
        findingId: f.findingId,
        weightedSeverity,
        requiresImmediate: weightedSeverity === 'CRITICAL' || weightedSeverity === 'HIGH',
      };
    });

    const immediateCount = details.filter((d) => d.requiresImmediate).length;
    const auditScore = findings.length > 0
      ? Math.round((1 - immediateCount / findings.length) * 100 * 100) / 100
      : 100;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'AUDIT_REPORTED',
      auditId,
      auditScore,
      immediateCount,
    });

    return { auditId, agencyId, auditScore, immediateCount, findings: details };
  }

  private escalate(severity: Severity): Severity {
    const idx = SEVERITY_ORDER.indexOf(severity);
    return SEVERITY_ORDER[Math.min(idx + 1, SEVERITY_ORDER.length - 1)]!;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
