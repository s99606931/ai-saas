// SVC-AI-ADV-R453 예산 집행 심층 분석 v2
// Design Ref: SVC-AI-ADV-R453.design.md
// Plan SC: FR-453.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Warning = 'UNDER' | 'OVER' | 'CARRYOVER_RISK' | 'NONE';

export interface BudgetEntry {
  readonly dept: string;
  readonly item: string;
  readonly allocated: number;
  readonly spent: number;
  readonly monthsElapsed: number;
  readonly monthsTotal: number;
}

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

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class BudgetExecutionAnalyzerV2 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(entries: readonly BudgetEntry[], grade: DataGrade = 'O'): AnalysisResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 예산 데이터 차단 (N2SF N-05)`);
    }

    const analyzed: AnalyzedEntry[] = [];
    for (const e of entries) {
      if (!e.dept) throw new Error('INVALID_DEPT');
      if (e.allocated <= 0) throw new Error(`INVALID_ALLOCATED: ${e.item}`);
      if (e.monthsTotal <= 0) throw new Error(`INVALID_MONTHS: ${e.item}`);
      if (e.monthsElapsed < 0 || e.monthsElapsed > e.monthsTotal) {
        throw new Error(`INVALID_ELAPSED: ${e.item}`);
      }

      const execRate = e.spent / e.allocated;
      const expectedRate = e.monthsElapsed / e.monthsTotal;
      let warning: Warning = 'NONE';
      if (execRate < expectedRate - 0.2) warning = 'UNDER';
      else if (execRate > expectedRate + 0.2) warning = 'OVER';
      if (expectedRate >= 0.9 && execRate < 0.7) warning = 'CARRYOVER_RISK';

      analyzed.push({
        dept: e.dept,
        item: e.item,
        execRate: Math.round(execRate * 1000) / 1000,
        expectedRate: Math.round(expectedRate * 1000) / 1000,
        warning,
      });
    }

    // 부서별 집계
    const deptMap = new Map<string, { sum: number; count: number; warnings: number }>();
    for (const a of analyzed) {
      const cur = deptMap.get(a.dept) ?? { sum: 0, count: 0, warnings: 0 };
      cur.sum += a.execRate;
      cur.count += 1;
      if (a.warning !== 'NONE') cur.warnings += 1;
      deptMap.set(a.dept, cur);
    }
    const deptSummaries: DeptSummary[] = [];
    for (const [dept, cur] of deptMap) {
      deptSummaries.push({
        dept,
        avgExecRate: Math.round((cur.sum / cur.count) * 1000) / 1000,
        warnings: cur.warnings,
      });
    }

    this.record('ANALYZE', 'budget', {
      entries: analyzed.length,
      depts: deptSummaries.length,
    });
    return { entries: analyzed, deptSummaries };
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
