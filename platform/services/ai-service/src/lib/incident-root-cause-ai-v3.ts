// Design Ref: SVC-AI-ADV-R605-v3.design.md §알고리즘
// Plan SC: SC-R605v3-1, SC-R605v3-2, SC-R605v3-3
// 트랙 A 22차

export interface IncidentSignal {
  incidentId: string;
  errorRate: number;
  latencyMs: number;
  cpuPct: number;
  memPct: number;
  deployedRecently: boolean;
}

export type RootCause =
  | 'CODE_ERROR'
  | 'RESOURCE_EXHAUSTION'
  | 'MEMORY_LEAK'
  | 'RECENT_DEPLOY'
  | 'UNKNOWN';
export type Recommendation = 'ROLLBACK' | 'SCALE_OUT' | 'MONITOR';
export type RcaSeverity = 'CRITICAL' | 'HIGH' | 'LOW';

export interface RcaResult {
  incidentId: string;
  rootCause: RootCause;
  recommendation: Recommendation;
  severity: RcaSeverity;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export class IncidentRootCauseAiV3 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(signal: IncidentSignal): RcaResult {
    let rootCause: RootCause;
    if (signal.errorRate > 0.5) rootCause = 'CODE_ERROR';
    else if (signal.latencyMs > 5000) rootCause = 'RESOURCE_EXHAUSTION';
    else if (signal.memPct > 90) rootCause = 'MEMORY_LEAK';
    else if (signal.deployedRecently) rootCause = 'RECENT_DEPLOY';
    else rootCause = 'UNKNOWN';

    let recommendation: Recommendation;
    let severity: RcaSeverity;
    switch (rootCause) {
      case 'CODE_ERROR':
        recommendation = 'ROLLBACK';
        severity = 'CRITICAL';
        break;
      case 'RECENT_DEPLOY':
        recommendation = 'ROLLBACK';
        severity = 'HIGH';
        break;
      case 'RESOURCE_EXHAUSTION':
      case 'MEMORY_LEAK':
        recommendation = 'SCALE_OUT';
        severity = 'HIGH';
        break;
      default:
        recommendation = 'MONITOR';
        severity = 'LOW';
    }

    const result: RcaResult = {
      incidentId: signal.incidentId,
      rootCause,
      recommendation,
      severity,
    };

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RCA_ANALYZE',
      details: { incidentId: signal.incidentId, rootCause, severity },
    });

    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
