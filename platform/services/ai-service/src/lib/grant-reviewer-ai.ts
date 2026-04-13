// SVC-AI-ADV-R421 AI-Powered Grant Reviewer
// Design Ref: SVC-AI-ADV-R421.design.md
// Plan SC: FR-421.1~5
// CSAP D-06/D-12 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type RiskLevel = 'LOW' | 'HIGH';

export interface GrantApplication {
  readonly applicantId: string;
  readonly income: number;
  readonly age: number;
  readonly familySize: number;
  readonly fraudHistory: boolean;
}

export interface GrantRule {
  readonly incomeCap: number;
  readonly minAge: number;
  readonly baseAmount: number;
}

export interface ReviewResult {
  readonly applicantId: string;
  readonly eligible: boolean;
  readonly recommendedAmount: number;
  readonly riskLevel: RiskLevel;
  readonly reasonCode: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class GrantReviewerAI {
  private readonly auditLog: AuditEntry[] = [];

  review(app: GrantApplication, rule: GrantRule, grade: DataGrade = 'O'): ReviewResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 보조금 데이터 차단 (N2SF N-05)`);
    }
    if (rule.incomeCap <= 0 || rule.baseAmount < 0) {
      throw new Error('INVALID_RULE');
    }

    const riskLevel: RiskLevel = app.fraudHistory ? 'HIGH' : 'LOW';
    let eligible = true;
    let reasonCode = 'OK';
    let recommendedAmount = 0;

    if (app.income > rule.incomeCap) {
      eligible = false;
      reasonCode = 'INCOME_OVER_CAP';
    } else if (app.age < rule.minAge) {
      eligible = false;
      reasonCode = 'AGE_UNDER_MIN';
    } else {
      const ratio = Math.max(0, Math.min(1, 1 - app.income / rule.incomeCap));
      recommendedAmount = Number((rule.baseAmount * ratio).toFixed(2));
    }

    const result: ReviewResult = {
      applicantId: app.applicantId,
      eligible,
      recommendedAmount,
      riskLevel,
      reasonCode,
    };
    this.record('REVIEW', app.applicantId, { eligible, recommendedAmount, riskLevel, reasonCode });
    return result;
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
