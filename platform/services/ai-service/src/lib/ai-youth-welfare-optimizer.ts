// SVC-AI-ADV-R487 AI Youth Welfare Optimizer
// Design Ref: SVC-AI-ADV-R487.design.md §청소년복지
// Plan SC: FR-487.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface YouthProfile {
  readonly youthId: string;
  readonly ageYears: number;
  readonly enrolledInSchool: boolean;
  readonly householdIncomeKrw: number;
  readonly hasParents: boolean;
  readonly mentalHealthScore: number;
  readonly academicScore: number;
  readonly riskBehaviors: number;
}

export interface WelfarePackage {
  readonly youthId: string;
  readonly priorityTier: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  readonly programs: readonly string[];
  readonly counselingSessionsPerMonth: number;
  readonly stipendKrwPerMonth: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 청소년 데이터 차단 (N2SF N-05)`);
  }
}

export class AiYouthWelfareOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  optimize(profile: YouthProfile, grade: DataGrade = 'O'): WelfarePackage {
    block(grade);

    let risk = 0;
    if (!profile.enrolledInSchool) risk += 25;
    if (!profile.hasParents) risk += 25;
    if (profile.householdIncomeKrw < 2_000_000) risk += 20;
    if (profile.mentalHealthScore < 50) risk += 15;
    if (profile.academicScore < 40) risk += 10;
    risk += profile.riskBehaviors * 5;

    const priorityTier: WelfarePackage['priorityTier'] =
      risk >= 70 ? 'RED' : risk >= 50 ? 'ORANGE' : risk >= 25 ? 'YELLOW' : 'GREEN';

    const programs: string[] = [];
    if (!profile.enrolledInSchool) programs.push('school_reentry');
    if (profile.householdIncomeKrw < 2_000_000) programs.push('income_support');
    if (profile.mentalHealthScore < 60) programs.push('mental_health_counseling');
    if (profile.academicScore < 50) programs.push('tutoring');
    if (!profile.hasParents) programs.push('foster_or_group_home');
    if (programs.length === 0) programs.push('youth_activity_voucher');

    const counselingSessionsPerMonth =
      priorityTier === 'RED' ? 8 : priorityTier === 'ORANGE' ? 4 : priorityTier === 'YELLOW' ? 2 : 0;
    const stipendKrwPerMonth =
      priorityTier === 'RED'
        ? 600_000
        : priorityTier === 'ORANGE'
          ? 400_000
          : priorityTier === 'YELLOW'
            ? 200_000
            : 0;

    this.appendAudit('YOUTH_OPT', {
      youthId: profile.youthId,
      tier: priorityTier,
      risk,
    });

    return {
      youthId: profile.youthId,
      priorityTier,
      programs,
      counselingSessionsPerMonth,
      stipendKrwPerMonth,
    };
  }

  budgetForecast(profiles: readonly YouthProfile[]): number {
    const packs = profiles.map((p) => this.optimize(p));
    const total = packs.reduce((acc, p) => acc + p.stipendKrwPerMonth * 12, 0);
    this.appendAudit('BUDGET', { youth: profiles.length, totalKrw: total });
    return total;
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
