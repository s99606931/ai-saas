// Design Ref: §SVC-AI-ADV-R449 — AI 기반 재정 감사 자동화
// Plan SC: FR-R449.1~5

export type ExpenseCategory = 'travel' | 'meal' | 'office';

export interface Expense {
  readonly id: string;
  readonly amount: number;
  readonly category: ExpenseCategory;
  readonly evidence: readonly string[];
  readonly date: string;
}

export type Reason = 'OVER_LIMIT' | 'NO_EVIDENCE' | 'DUPLICATE';

export interface Finding {
  readonly id: string;
  readonly reasons: readonly Reason[];
  readonly risk: 'HIGH' | 'MED' | 'LOW';
}

export interface AuditResult {
  readonly total: number;
  readonly flagged: number;
  readonly findings: readonly Finding[];
}

const LIMITS: Record<ExpenseCategory, number> = {
  travel: 500000,
  meal: 100000,
  office: 200000,
};

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class FinancialAuditAutomator {
  private readonly auditLog: AuditEvent[] = [];

  audit(expenses: readonly Expense[]): AuditResult {
    const seen = new Map<string, string>(); // key -> first expense id
    const findings: Finding[] = [];

    for (const exp of expenses) {
      const reasons: Reason[] = [];

      if (exp.amount > LIMITS[exp.category]) {
        reasons.push('OVER_LIMIT');
      }
      if (exp.evidence.length === 0) {
        reasons.push('NO_EVIDENCE');
      }

      // Duplicate detection: same category + date + amount
      const dupKey = `${exp.category}:${exp.date}:${exp.amount}`;
      if (seen.has(dupKey)) {
        reasons.push('DUPLICATE');
      } else {
        seen.set(dupKey, exp.id);
      }

      if (reasons.length > 0) {
        const risk: 'HIGH' | 'MED' | 'LOW' =
          reasons.includes('OVER_LIMIT') || reasons.includes('DUPLICATE')
            ? 'HIGH'
            : reasons.includes('NO_EVIDENCE')
            ? 'MED'
            : 'LOW';
        findings.push({ id: exp.id, reasons, risk });
      }
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'financial.audit',
      details: {
        total: expenses.length,
        flagged: findings.length,
        highRisk: findings.filter(f => f.risk === 'HIGH').length,
      },
    });

    return {
      total: expenses.length,
      flagged: findings.length,
      findings,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
