// SVC-AI-ADV-R349 Predictive Workload Distributor
// Design Ref: SVC-AI-ADV-R349.design.md
// Plan SC: SC-R349-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface WorkloadNode {
  readonly id: string;
  readonly capacity: number;
  load: number;
}

export interface Assignment {
  readonly nodeId: string;
  readonly addedLoad: number;
}

export interface DistributionPlan {
  readonly predicted: number;
  readonly assignments: readonly Assignment[];
  readonly overflow: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PredictiveWorkloadDistributor {
  private readonly auditLog: AuditEntry[] = [];

  plan(
    history: readonly number[],
    windowSize: number,
    nodes: readonly WorkloadNode[],
    grade: DataGrade = 'O',
  ): DistributionPlan {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 부하 데이터 차단 (N2SF N-05)`);
    }
    if (history.length === 0) {
      throw new Error('INVALID_PARAMS: empty history');
    }
    if (nodes.length === 0) {
      throw new Error('INVALID_PARAMS: empty nodes');
    }

    const window = history.slice(-windowSize);
    const sum = window.reduce((a, b) => a + b, 0);
    const predicted = Number((sum / window.length).toFixed(4));

    const working: Array<{ id: string; capacity: number; load: number; added: number }> = nodes.map(
      (n) => ({ id: n.id, capacity: n.capacity, load: n.load, added: 0 }),
    );

    let remaining = predicted;
    const unit = 1;
    const maxIterations = 10000;
    let iterations = 0;
    while (remaining > 0 && iterations < maxIterations) {
      iterations += 1;
      working.sort((a, b) => a.load + a.added - (b.load + b.added));
      const target = working[0];
      if (!target) break;
      const headroom = target.capacity - target.load - target.added;
      if (headroom <= 0) break;
      const step = Math.min(unit, headroom, remaining);
      target.added += step;
      remaining -= step;
    }

    const assignments: Assignment[] = working
      .filter((w) => w.added > 0)
      .map((w) => ({ nodeId: w.id, addedLoad: Number(w.added.toFixed(4)) }));

    const plan: DistributionPlan = {
      predicted,
      assignments,
      overflow: Number(Math.max(0, remaining).toFixed(4)),
    };

    this.record('PLAN', 'distribution', {
      predicted,
      overflow: plan.overflow,
      assignmentCount: assignments.length,
    });

    return plan;
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
