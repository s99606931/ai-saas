// SVC-AI-ADV-R426 Workforce Planning AI
// Design Ref: SVC-AI-ADV-R426.design.md
// Plan SC: FR-426.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type PlanAction = 'INCREASE' | 'DECREASE' | 'MAINTAIN';

export interface DeptStatus {
  readonly deptId: string;
  readonly workload: number;
  readonly headcount: number;
}

export interface PlanAdvice {
  readonly deptId: string;
  readonly loadPerHead: number;
  readonly action: PlanAction;
  readonly neededDelta: number;
}

export interface PlanResult {
  readonly advices: readonly PlanAdvice[];
  readonly topIncreaseDepts: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class WorkforcePlanningAI {
  private readonly auditLog: AuditEntry[] = [];

  plan(depts: readonly DeptStatus[], threshold: number, grade: DataGrade = 'O'): PlanResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 인사 데이터 차단 (N2SF N-05)`);
    }
    if (threshold <= 0) {
      throw new Error('INVALID_THRESHOLD');
    }

    const advices: PlanAdvice[] = depts.map((d) => {
      if (d.headcount <= 0) {
        throw new Error(`INVALID_HEADCOUNT: ${d.deptId}`);
      }
      const loadPerHead = Number((d.workload / d.headcount).toFixed(2));
      let action: PlanAction;
      if (loadPerHead > threshold * 1.2) action = 'INCREASE';
      else if (loadPerHead < threshold * 0.6) action = 'DECREASE';
      else action = 'MAINTAIN';
      const neededDelta = Math.round(d.workload / threshold) - d.headcount;
      return { deptId: d.deptId, loadPerHead, action, neededDelta };
    });

    const topIncreaseDepts = advices
      .filter((a) => a.action === 'INCREASE')
      .sort((a, b) => b.neededDelta - a.neededDelta)
      .slice(0, 3)
      .map((a) => a.deptId);

    this.record('PLAN', 'workforce', { total: depts.length, topIncreaseDepts });
    return { advices, topIncreaseDepts };
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
