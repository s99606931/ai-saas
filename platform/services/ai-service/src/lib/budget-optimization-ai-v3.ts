// Design Ref: SVC-AI-ADV-R607-v3.design.md §알고리즘
// Plan SC: SC-R607v3-1, SC-R607v3-2, SC-R607v3-3
// 트랙 A 22차

export type BudgetPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type BudgetAction = 'REDUCE' | 'INCREASE' | 'HOLD';

export interface BudgetItem {
  id: string;
  allocated: number;
  spent: number;
  priority: BudgetPriority;
}

export interface BudgetItemResult {
  id: string;
  utilization: number;
  action: BudgetAction;
}

export interface BudgetOptimizationResult {
  totalAllocated: number;
  totalSpent: number;
  overallUtilization: number;
  items: BudgetItemResult[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

export class BudgetOptimizationAiV3 {
  private readonly auditLog: AuditEntry[] = [];

  optimize(items: BudgetItem[]): BudgetOptimizationResult {
    const itemResults: BudgetItemResult[] = items.map((it) => {
      const utilization = it.allocated > 0 ? it.spent / it.allocated : 0;
      let action: BudgetAction = 'HOLD';
      if (utilization < 0.5 && it.priority === 'LOW') action = 'REDUCE';
      else if (utilization > 0.9 && it.priority === 'HIGH') action = 'INCREASE';
      return { id: it.id, utilization, action };
    });

    const totalAllocated = items.reduce((s, i) => s + i.allocated, 0);
    const totalSpent = items.reduce((s, i) => s + i.spent, 0);
    const overallUtilization = totalAllocated > 0 ? totalSpent / totalAllocated : 0;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'BUDGET_OPTIMIZE',
      details: { totalAllocated, totalSpent, overallUtilization },
    });

    return {
      totalAllocated,
      totalSpent,
      overallUtilization,
      items: itemResults,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
