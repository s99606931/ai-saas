// SVC-AI-ADV-R448 공공 계약 이행 모니터
// Design Ref: SVC-AI-ADV-R448.design.md
// Plan SC: FR-448.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Milestone {
  readonly id: string;
  readonly dueDate: string;
  readonly progress: number;
  readonly weight: number;
}

export type MilestoneStatus = 'DONE' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

export interface MilestoneStatusEntry {
  readonly id: string;
  readonly status: MilestoneStatus;
}

export interface ContractReport {
  readonly overallProgress: number;
  readonly statuses: readonly MilestoneStatusEntry[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicContractMonitor {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(
    milestones: readonly Milestone[],
    today: string,
    grade: DataGrade = 'O',
  ): ContractReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 계약 데이터 차단 (N2SF N-05)`);
    }
    const t = Date.parse(today);
    if (Number.isNaN(t)) throw new Error('INVALID_TODAY');

    let sumW = 0;
    let weighted = 0;
    const statuses: MilestoneStatusEntry[] = [];

    for (const m of milestones) {
      if (!m.id) throw new Error('INVALID_MILESTONE_ID');
      if (m.progress < 0 || m.progress > 1) throw new Error(`INVALID_PROGRESS: ${m.id}`);
      if (m.weight <= 0) throw new Error(`INVALID_WEIGHT: ${m.id}`);
      const due = Date.parse(m.dueDate);
      if (Number.isNaN(due)) throw new Error(`INVALID_DUEDATE: ${m.id}`);

      sumW += m.weight;
      weighted += m.weight * m.progress;

      let status: MilestoneStatus;
      if (m.progress >= 1) {
        status = 'DONE';
      } else if (due < t) {
        status = 'OVERDUE';
      } else {
        // 시작일을 알 수 없어, 남은 일수 기반 간단 판정
        const daysLeft = (due - t) / 86400000;
        // progress < 0.5 && daysLeft < 7 → AT_RISK
        status = daysLeft < 7 && m.progress < 0.5 ? 'AT_RISK' : 'ON_TRACK';
      }
      statuses.push({ id: m.id, status });
    }

    const overallProgress =
      sumW === 0 ? 0 : Number((weighted / sumW).toFixed(4));

    this.record('EVALUATE', 'contract', {
      milestones: milestones.length,
      overallProgress,
    });
    return { overallProgress, statuses };
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
