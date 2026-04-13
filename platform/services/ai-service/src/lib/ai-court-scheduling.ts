// SVC-AI-ADV-R467 AI Court Scheduling
// Design Ref: SVC-AI-ADV-R467.design.md
// Plan SC: FR-467.1~7
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type CaseType = 'civil' | 'criminal' | 'admin';

export interface CourtCase {
  readonly id: string;
  readonly type: CaseType;
  readonly priority: 1 | 2 | 3 | 4 | 5;
}

export interface Judge {
  readonly id: string;
  readonly specialties: readonly CaseType[];
  readonly dailyCapacity: number;
  currentLoad: number;
}

export interface Assignment {
  readonly caseId: string;
  readonly judgeId: string;
}

export interface ScheduleResult {
  readonly assignments: readonly Assignment[];
  readonly unscheduled: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class AiCourtScheduling {
  private readonly auditLog: AuditEntry[] = [];

  schedule(
    cases: readonly CourtCase[],
    judges: Judge[],
    grade: DataGrade = 'O',
  ): ScheduleResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 사건 데이터 차단 (N2SF N-05)`);
    }
    for (const j of judges) {
      if (j.currentLoad < 0 || j.dailyCapacity < 0) {
        throw new Error(`INVALID_JUDGE: ${j.id}`);
      }
    }

    const sorted = [...cases].sort((a, b) => b.priority - a.priority);
    const assignments: Assignment[] = [];
    const unscheduled: string[] = [];

    for (const c of sorted) {
      const eligible = judges
        .filter((j) => j.specialties.includes(c.type) && j.currentLoad < j.dailyCapacity)
        .sort((a, b) => a.currentLoad - b.currentLoad);
      if (eligible.length === 0) {
        unscheduled.push(c.id);
        continue;
      }
      const chosen = eligible[0];
      if (!chosen) {
        unscheduled.push(c.id);
        continue;
      }
      chosen.currentLoad += 1;
      assignments.push({ caseId: c.id, judgeId: chosen.id });
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'COURT_SCHEDULE',
      details: { assigned: assignments.length, unscheduled: unscheduled.length },
    });

    return { assignments, unscheduled };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
