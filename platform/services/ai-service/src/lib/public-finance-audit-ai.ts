// SVC-AI-ADV-R449 공공 재정 감사 자동화 AI
// Design Ref: SVC-AI-ADV-R449.design.md
// Plan SC: FR-449.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type ExpenseCategory = 'travel' | 'meal' | 'office';

export interface Expense {
  readonly id: string;
  readonly amount: number;
  readonly category: ExpenseCategory;
  readonly evidence: readonly string[];
  readonly date: string;
}

export type Reason = 'OVER_LIMIT' | 'NO_EVIDENCE' | 'DUPLICATE';
export type Risk = 'HIGH' | 'MED' | 'LOW';

export interface Finding {
  readonly id: string;
  readonly reasons: readonly Reason[];
  readonly risk: Risk;
}

export interface AuditResult {
  readonly total: number;
  readonly flagged: number;
  readonly findings: readonly Finding[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const LIMITS: Record<ExpenseCategory, number> = {
  travel: 500000,
  meal: 100000,
  office: 200000,
};

export class PublicFinanceAuditAI {
  private readonly auditLog: AuditEntry[] = [];

  audit(expenses: readonly Expense[], grade: DataGrade = 'O'): AuditResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 재정 데이터 차단 (N2SF N-05)`);
    }

    // 중복 감지: 같은 date/category/amount가 2회 이상
    const sigCount = new Map<string, number>();
    for (const e of expenses) {
      const sig = `${e.date}|${e.category}|${e.amount}`;
      sigCount.set(sig, (sigCount.get(sig) ?? 0) + 1);
    }

    const findings: Finding[] = [];
    for (const e of expenses) {
      if (!e.id) throw new Error('INVALID_EXPENSE_ID');
      if (e.amount < 0) throw new Error(`INVALID_AMOUNT: ${e.id}`);

      const reasons: Reason[] = [];
      if (e.amount > LIMITS[e.category]) reasons.push('OVER_LIMIT');
      if (e.evidence.length === 0) reasons.push('NO_EVIDENCE');
      const sig = `${e.date}|${e.category}|${e.amount}`;
      if ((sigCount.get(sig) ?? 0) >= 2) reasons.push('DUPLICATE');

      if (reasons.length === 0) continue;
      const risk: Risk = reasons.length >= 2 ? 'HIGH' : reasons.includes('OVER_LIMIT') ? 'HIGH' : 'MED';
      findings.push({ id: e.id, reasons, risk });
    }

    this.record('AUDIT', 'finance', {
      total: expenses.length,
      flagged: findings.length,
    });
    return {
      total: expenses.length,
      flagged: findings.length,
      findings,
    };
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
