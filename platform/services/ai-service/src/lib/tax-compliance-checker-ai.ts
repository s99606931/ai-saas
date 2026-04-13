// SVC-AI-ADV-R425 AI-Based Tax Compliance Checker
// Design Ref: SVC-AI-ADV-R425.design.md
// Plan SC: FR-425.1~5
// CSAP D-06/D-12 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaxFiling {
  readonly filingId: string;
  readonly taxpayerId: string;
  readonly income: number;
  readonly deduction: number;
  readonly declaredTax: number;
  readonly calculatedTax: number;
}

export interface Issue {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
}

export interface CheckResult {
  readonly filingId: string;
  readonly compliant: boolean;
  readonly issues: readonly Issue[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class TaxComplianceCheckerAI {
  private readonly auditLog: AuditEntry[] = [];

  check(filing: TaxFiling, grade: DataGrade = 'O'): CheckResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 세무 데이터 차단 (N2SF N-05)`);
    }

    const issues: Issue[] = [];

    if (!filing.taxpayerId || filing.taxpayerId.trim() === '') {
      issues.push({
        code: 'MISSING_TAXPAYER_ID',
        severity: 'CRITICAL',
        message: '납세자 ID 누락',
      });
    }
    if (filing.income < 0) {
      issues.push({ code: 'INVALID_INCOME', severity: 'CRITICAL', message: '소득 음수 불가' });
    }

    if (filing.income > 0 && filing.deduction > filing.income * 0.5) {
      issues.push({
        code: 'OVER_DEDUCTION',
        severity: 'HIGH',
        message: '공제액이 소득의 50% 초과',
      });
    }

    const diff = Math.abs(filing.declaredTax - filing.calculatedTax);
    if (diff > 100) {
      issues.push({
        code: 'CALC_MISMATCH',
        severity: 'MEDIUM',
        message: `신고세액-계산세액 차이 ${diff}원`,
      });
    }

    const blocking = issues.some((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH');
    const compliant = !blocking;

    this.record('CHECK', filing.filingId, { compliant, issueCount: issues.length });
    return { filingId: filing.filingId, compliant, issues };
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
