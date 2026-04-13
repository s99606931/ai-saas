// Design Ref: §SVC-AI-ADV-R453 — 예산 집행 심층 분석 v2
// Plan SC: FR-R453.1~5

export interface BudgetEntry {
  readonly dept: string;
  readonly item: string;
  readonly allocated: number;
  readonly spent: number;
  readonly monthsElapsed: number;
  readonly monthsTotal: number;
}

export type Warning = 'UNDER' | 'OVER' | 'CARRYOVER_RISK' | 'NONE';

export interface AnalyzedEntry {
  readonly dept: string;
  readonly item: string;
  readonly execRate: number;
  readonly expectedRate: number;
  readonly warning: Warning;
}

export interface DeptSummary {
  readonly dept: string;
  readonly avgExecRate: number;
  readonly warnings: number;
}

export interface AnalysisResult {
  readonly entries: readonly AnalyzedEntry[];
  readonly deptSummaries: readonly DeptSummary[];
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class BudgetExecutionAnalyzer {
  private readonly auditLog: AuditEvent[] = [];

  private classifyWarning(execRate: number, expectedRate: number, monthsElapsed: number, monthsTotal: number): Warning {
    if (execRate > 1.0) return 'OVER';
    // CARRYOVER_RISK: near end of fiscal year but large unspent budget
    const remainingMonths = monthsTotal - monthsElapsed;
    if (remainingMonths <= 2 && execRate < 0.7) return 'CARRYOVER_RISK';
    if (execRate < expectedRate - 0.2) return 'UNDER';
    return 'NONE';
  }

  analyze(entries: readonly BudgetEntry[]): AnalysisResult {
    const analyzed: AnalyzedEntry[] = entries.map(e => {
      const execRate = e.allocated === 0 ? 0 : e.spent / e.allocated;
      const expectedRate = e.monthsTotal === 0 ? 0 : e.monthsElapsed / e.monthsTotal;
      const warning = this.classifyWarning(execRate, expectedRate, e.monthsElapsed, e.monthsTotal);
      return {
        dept: e.dept,
        item: e.item,
        execRate: Math.round(execRate * 1000) / 1000,
        expectedRate: Math.round(expectedRate * 1000) / 1000,
        warning,
      };
    });

    // Group by dept for summaries
    const deptMap = new Map<string, { rates: number[]; warnings: number }>();
    for (const a of analyzed) {
      const existing = deptMap.get(a.dept);
      const warningCount = a.warning !== 'NONE' ? 1 : 0;
      if (existing) {
        existing.rates.push(a.execRate);
        existing.warnings += warningCount;
      } else {
        deptMap.set(a.dept, { rates: [a.execRate], warnings: warningCount });
      }
    }

    const deptSummaries: DeptSummary[] = [...deptMap.entries()].map(([dept, d]) => ({
      dept,
      avgExecRate: Math.round((d.rates.reduce((s, r) => s + r, 0) / d.rates.length) * 1000) / 1000,
      warnings: d.warnings,
    }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'budget.analyze',
      details: {
        entryCount: entries.length,
        deptCount: deptSummaries.length,
        warningCount: analyzed.filter(a => a.warning !== 'NONE').length,
      },
    });

    return { entries: analyzed, deptSummaries };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
