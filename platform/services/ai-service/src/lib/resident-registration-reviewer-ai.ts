// SVC-AI-ADV-R431 Resident Registration Auto Reviewer AI
// Design Ref: SVC-AI-ADV-R431.design.md
// Plan SC: FR-431.1~5
// CSAP D-06/D-08 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Decision = 'APPROVED' | 'HOLD' | 'REJECTED';

export interface Application {
  readonly name: string;
  readonly rrn: string;
  readonly address: string;
  readonly reason: string;
  readonly evidenceCount: number;
  readonly lastChangeDate: string;
}

export interface Review {
  readonly decision: Decision;
  readonly reasons: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const RRN_RE = /^\d{6}-\d{7}$/;

export class ResidentRegistrationReviewerAI {
  private readonly auditLog: AuditEntry[] = [];

  review(app: Application, grade: DataGrade = 'O'): Review {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 주민 데이터 차단 (N2SF N-05)`);
    }

    const reasons: string[] = [];
    let decision: Decision = 'APPROVED';

    if (!app.name || !app.rrn || !app.address || !app.reason) {
      reasons.push('MISSING_FIELD');
      decision = 'REJECTED';
    }
    if (!RRN_RE.test(app.rrn)) {
      reasons.push('INVALID_RRN');
      decision = 'REJECTED';
    }
    if (decision !== 'REJECTED') {
      const last = new Date(app.lastChangeDate).getTime();
      if (!Number.isFinite(last)) {
        reasons.push('INVALID_DATE');
        decision = 'REJECTED';
      } else {
        const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
        if (days < 30) {
          reasons.push('COOLDOWN_NOT_MET');
          decision = 'HOLD';
        }
      }
    }
    if (decision === 'APPROVED' && app.evidenceCount < 2) {
      reasons.push('INSUFFICIENT_EVIDENCE');
      decision = 'HOLD';
    }

    this.record('REVIEW', app.name, { decision, reasons });
    return { decision, reasons };
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
