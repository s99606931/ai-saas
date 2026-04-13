// SVC-AI-ADV-R469 Social Service Eligibility AI
// Design Ref: SVC-AI-ADV-R469.design.md
// Plan SC: FR-469.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Applicant {
  readonly id: string;
  readonly age: number;
  readonly householdSize: number;
  readonly monthlyIncome: number;
}

export interface EligibilityResult {
  readonly id: string;
  readonly eligibleServices: readonly string[];
  readonly reasons: Readonly<Record<string, string>>;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class SocialServiceEligibilityAi {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(applicant: Applicant, grade: DataGrade = 'O'): EligibilityResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 신청자 데이터 차단 (N2SF N-05)`);
    }
    if (applicant.age < 0 || applicant.householdSize < 1 || applicant.monthlyIncome < 0) {
      throw new Error(`INVALID_APPLICANT: ${applicant.id}`);
    }

    const eligible: string[] = [];
    const reasons: Record<string, string> = {};

    const basicThreshold = 1_000_000 * applicant.householdSize;
    if (applicant.monthlyIncome <= basicThreshold) {
      eligible.push('basic-livelihood');
    } else {
      reasons['basic-livelihood'] = `소득 초과 (기준: ${basicThreshold}원)`;
    }

    if (applicant.age >= 65) {
      eligible.push('elder-care');
    } else {
      reasons['elder-care'] = '연령 미달 (65세 이상)';
    }

    if (applicant.age < 8) {
      eligible.push('child-allowance');
    } else {
      reasons['child-allowance'] = '연령 초과 (8세 미만)';
    }

    if (applicant.householdSize <= 2 && applicant.monthlyIncome <= 3_000_000) {
      eligible.push('single-parent');
    } else {
      reasons['single-parent'] = '가구원 수 또는 소득 기준 초과';
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ELIGIBILITY_EVAL',
      details: { id: applicant.id, count: eligible.length },
    });

    return { id: applicant.id, eligibleServices: eligible, reasons };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
