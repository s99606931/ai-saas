// Design Ref: §SVC-AI-ADV-R448 — 공공 계약 이행 모니터
// Plan SC: FR-R448.1~5

export interface Milestone {
  readonly id: string;
  readonly dueDate: string;
  readonly progress: number;
  readonly weight: number;
}

export type MilestoneStatus = 'DONE' | 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

export interface ContractReport {
  readonly overallProgress: number;
  readonly statuses: readonly { id: string; status: MilestoneStatus }[];
}

export interface ContractMonitorOptions {
  today?: string;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ContractFulfillmentMonitor {
  private readonly auditLog: AuditEvent[] = [];

  private now(opts?: ContractMonitorOptions): Date {
    return opts?.today ? new Date(opts.today) : new Date();
  }

  private classifyMilestone(m: Milestone, today: Date): MilestoneStatus {
    if (m.progress >= 100) return 'DONE';
    const due = new Date(m.dueDate);
    if (today > due) return 'OVERDUE';
    const msRemaining = due.getTime() - today.getTime();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
    // AT_RISK: progress < expected given time, or < 14 days left with < 80% done
    if (daysRemaining <= 14 && m.progress < 80) return 'AT_RISK';
    return 'ON_TRACK';
  }

  analyze(milestones: readonly Milestone[], opts?: ContractMonitorOptions): ContractReport {
    // N2SF: no C/S grade data passed to external AI — internal computation only
    const today = this.now(opts);

    const totalWeight = milestones.reduce((s, m) => s + m.weight, 0);
    const overallProgress = totalWeight === 0
      ? 0
      : milestones.reduce((s, m) => s + m.progress * m.weight, 0) / totalWeight;

    const statuses = milestones.map(m => ({
      id: m.id,
      status: this.classifyMilestone(m, today),
    }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'contract.analyze',
      details: {
        milestoneCount: milestones.length,
        overallProgress: Math.round(overallProgress * 10) / 10,
        overdueCount: statuses.filter(s => s.status === 'OVERDUE').length,
      },
    });

    return {
      overallProgress: Math.round(overallProgress * 10) / 10,
      statuses,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
