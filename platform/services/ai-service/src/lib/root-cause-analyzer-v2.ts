// Design Ref: §근원 분류 — errorRate>0.5:CODE_ERROR / latencySpike>5000:RESOURCE_EXHAUSTION / memUsage>90:MEMORY_LEAK
// Plan SC: SC-R539-1, SC-R539-2, SC-R539-3

interface IncidentInput {
  incidentId: string;
  affectedService: string;
  symptoms: string[];
  errorRate: number;
  latencySpike: number;
  memUsage: number;
}

type RootCause = 'CODE_ERROR' | 'RESOURCE_EXHAUSTION' | 'MEMORY_LEAK' | 'UNKNOWN';
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type RecoveryAction = 'ROLLBACK' | 'SCALE_OUT' | 'RESTART' | 'MONITOR';

interface RootCauseResult {
  incidentId: string;
  affectedService: string;
  rootCause: RootCause;
  severity: Severity;
  recommendation: RecoveryAction;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  incidentId: string;
  rootCause: RootCause;
  severity: Severity;
}

export class RootCauseAnalyzerV2 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(input: IncidentInput): RootCauseResult {
    const { incidentId, affectedService, errorRate, latencySpike, memUsage } = input;

    const rootCause = this.classifyRootCause(errorRate, latencySpike, memUsage);
    const severity = this.classifySeverity(rootCause, errorRate);
    const recommendation = this.buildRecommendation(severity);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ROOT_CAUSE_ANALYZED',
      incidentId,
      rootCause,
      severity,
    });

    return { incidentId, affectedService, rootCause, severity, recommendation };
  }

  private classifyRootCause(errorRate: number, latencySpike: number, memUsage: number): RootCause {
    if (errorRate > 0.5) return 'CODE_ERROR';
    if (latencySpike > 5000) return 'RESOURCE_EXHAUSTION';
    if (memUsage > 90) return 'MEMORY_LEAK';
    return 'UNKNOWN';
  }

  private classifySeverity(rootCause: RootCause, errorRate: number): Severity {
    if (rootCause === 'CODE_ERROR' && errorRate > 0.8) return 'CRITICAL';
    if (rootCause === 'RESOURCE_EXHAUSTION' || rootCause === 'CODE_ERROR') return 'HIGH';
    if (rootCause === 'MEMORY_LEAK') return 'MEDIUM';
    return 'LOW';
  }

  private buildRecommendation(severity: Severity): RecoveryAction {
    if (severity === 'CRITICAL') return 'ROLLBACK';
    if (severity === 'HIGH') return 'SCALE_OUT';
    if (severity === 'MEDIUM') return 'RESTART';
    return 'MONITOR';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
