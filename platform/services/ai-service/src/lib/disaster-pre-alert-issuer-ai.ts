// SVC-AI-ADV-R438 Disaster Pre-Alert Auto Issuer AI
// Design Ref: SVC-AI-ADV-R438.design.md
// Plan SC: FR-438.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type DisasterKind = 'RAINFALL' | 'SEISMIC' | 'FLOOD';
export type AlertLevel = 'NONE' | 'CAUTION' | 'WARNING' | 'SEVERE';

export interface Reading {
  readonly kind: DisasterKind;
  readonly metric: number;
}

export interface Alert {
  readonly kind: DisasterKind;
  readonly level: AlertLevel;
  readonly metric: number;
  readonly threshold: number;
  readonly issuedAt: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const THRESHOLDS: Record<DisasterKind, { caution: number; warning: number; severe: number }> = {
  RAINFALL: { caution: 30, warning: 60, severe: 100 },
  SEISMIC: { caution: 3.5, warning: 5.0, severe: 6.5 },
  FLOOD: { caution: 2, warning: 4, severe: 6 },
};

export class DisasterPreAlertIssuerAI {
  private readonly auditLog: AuditEntry[] = [];

  issue(reading: Reading, grade: DataGrade = 'O'): Alert {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 재난 데이터 차단 (N2SF N-05)`);
    }
    const t = THRESHOLDS[reading.kind];
    if (!t) throw new Error(`UNKNOWN_KIND: ${reading.kind}`);
    if (reading.metric < 0) throw new Error('INVALID_METRIC');

    let level: AlertLevel = 'NONE';
    let threshold = 0;
    if (reading.metric >= t.severe) {
      level = 'SEVERE';
      threshold = t.severe;
    } else if (reading.metric >= t.warning) {
      level = 'WARNING';
      threshold = t.warning;
    } else if (reading.metric >= t.caution) {
      level = 'CAUTION';
      threshold = t.caution;
    }

    const alert: Alert = {
      kind: reading.kind,
      level,
      metric: reading.metric,
      threshold,
      issuedAt: new Date().toISOString(),
    };
    this.record('ISSUE', reading.kind, { level, metric: reading.metric });
    return alert;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
