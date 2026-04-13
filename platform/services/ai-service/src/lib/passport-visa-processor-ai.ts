// SVC-AI-ADV-R432 Passport/Visa AI Processor
// Design Ref: SVC-AI-ADV-R432.design.md
// Plan SC: FR-432.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Urgency = 'URGENT' | 'HIGH' | 'NORMAL';
export type Status = 'INCOMPLETE' | 'READY';

export interface PassportApp {
  readonly applicantId: string;
  readonly documents: readonly string[];
  readonly departureDate: string;
}

export interface Processed {
  readonly applicantId: string;
  readonly urgency: Urgency;
  readonly completeness: number;
  readonly status: Status;
  readonly missing: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const REQUIRED = ['photo', 'idCopy', 'application', 'fee'] as const;

export class PassportVisaProcessorAI {
  private readonly auditLog: AuditEntry[] = [];

  process(apps: readonly PassportApp[], grade: DataGrade = 'O'): readonly Processed[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 여권 데이터 차단 (N2SF N-05)`);
    }

    const now = Date.now();
    const processed: Processed[] = apps.map((a) => {
      const submitted = new Set(a.documents);
      const missing = REQUIRED.filter((r) => !submitted.has(r));
      const completeness = Number(
        ((REQUIRED.length - missing.length) / REQUIRED.length).toFixed(4),
      );
      const status: Status = missing.length === 0 ? 'READY' : 'INCOMPLETE';
      const dep = new Date(a.departureDate).getTime();
      const days = Number.isFinite(dep) ? (dep - now) / (1000 * 60 * 60 * 24) : 9999;
      let urgency: Urgency;
      if (days <= 7) urgency = 'URGENT';
      else if (days <= 30) urgency = 'HIGH';
      else urgency = 'NORMAL';
      return {
        applicantId: a.applicantId,
        urgency,
        completeness,
        status,
        missing,
      };
    });

    const rank: Record<Urgency, number> = { URGENT: 3, HIGH: 2, NORMAL: 1 };
    const sorted = [...processed].sort((a, b) => {
      if (rank[a.urgency] !== rank[b.urgency]) return rank[b.urgency] - rank[a.urgency];
      return b.completeness - a.completeness;
    });

    this.record('PROCESS', 'batch', { count: sorted.length });
    return sorted;
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
