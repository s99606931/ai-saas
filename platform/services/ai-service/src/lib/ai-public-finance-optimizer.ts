// SVC-AI-ADV-R476 AI Public Finance Optimizer
// Design Ref: SVC-AI-ADV-R476.design.md §공공재정
// Plan SC: FR-476.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface BudgetItem {
  readonly id: string;
  readonly category: string;
  readonly requested: number;
  readonly priorityScore: number; // 0..100
  readonly mandatory: boolean;
}

export interface AllocationResult {
  readonly id: string;
  readonly allocated: number;
  readonly percentage: number;
}

export interface OptimizationReport {
  readonly totalBudget: number;
  readonly totalRequested: number;
  readonly allocations: readonly AllocationResult[];
  readonly efficiency: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 재정 데이터 차단 (N2SF N-05)`);
  }
}

export class AiPublicFinanceOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  optimize(
    items: readonly BudgetItem[],
    totalBudget: number,
    grade: DataGrade = 'O',
  ): OptimizationReport {
    block(grade);

    if (totalBudget < 0) {
      throw new Error('totalBudget must be non-negative');
    }

    let remaining = totalBudget;
    const allocations: AllocationResult[] = [];

    // Step 1: mandatory items first
    const mandatory = items.filter((i) => i.mandatory);
    const optional = items.filter((i) => !i.mandatory);

    for (const m of mandatory) {
      const give = Math.min(m.requested, remaining);
      remaining -= give;
      allocations.push({
        id: m.id,
        allocated: give,
        percentage: m.requested === 0 ? 0 : Number(((give / m.requested) * 100).toFixed(2)),
      });
    }

    // Step 2: optional items sorted by priority
    const sorted = [...optional].sort((a, b) => b.priorityScore - a.priorityScore);
    const totalPriority = sorted.reduce((s, i) => s + Math.max(1, i.priorityScore), 0);

    for (const o of sorted) {
      if (remaining <= 0) {
        allocations.push({ id: o.id, allocated: 0, percentage: 0 });
        continue;
      }
      const weight = Math.max(1, o.priorityScore) / totalPriority;
      const share = Math.min(o.requested, remaining, totalBudget * weight * 2);
      remaining -= share;
      allocations.push({
        id: o.id,
        allocated: share,
        percentage: o.requested === 0 ? 0 : Number(((share / o.requested) * 100).toFixed(2)),
      });
    }

    const totalRequested = items.reduce((s, i) => s + i.requested, 0);
    const allocatedSum = allocations.reduce((s, a) => s + a.allocated, 0);
    const efficiency =
      totalRequested === 0 ? 100 : Number(((allocatedSum / Math.min(totalRequested, totalBudget)) * 100).toFixed(2));

    this.appendAudit('FINANCE_OPTIMIZE', {
      totalBudget,
      totalRequested,
      items: items.length,
    });

    return {
      totalBudget,
      totalRequested,
      allocations,
      efficiency,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
