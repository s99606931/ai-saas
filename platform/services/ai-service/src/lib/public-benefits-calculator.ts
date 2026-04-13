// SVC-AI-ADV-R396 Public Benefits Calculator
// Design Ref: SVC-AI-ADV-R396.design.md
// Plan SC: SC-R396-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface BenefitProgram {
  readonly id: string;
  readonly name: string;
  readonly incomeCap: number;
  readonly minAge: number;
  readonly baseAmount: number;
  readonly perMemberBonus: number;
}

export interface Applicant {
  readonly income: number;
  readonly age: number;
  readonly householdSize: number;
}

export interface BenefitResult {
  readonly programId: string;
  readonly eligible: boolean;
  readonly amount: number;
  readonly reason: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicBenefitsCalculator {
  private readonly programs = new Map<string, BenefitProgram>();
  private readonly auditLog: AuditEntry[] = [];

  registerProgram(program: BenefitProgram): void {
    if (program.incomeCap < 0 || program.minAge < 0 || program.baseAmount < 0) {
      throw new Error('INVALID_PROGRAM: 음수 값 불가');
    }
    this.programs.set(program.id, program);
    this.record('REGISTER_PROGRAM', program.id, { name: program.name });
  }

  evaluate(programId: string, applicant: Applicant, grade: DataGrade = 'O'): BenefitResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 신청자 데이터 차단 (N2SF N-05)`);
    }
    const program = this.programs.get(programId);
    if (!program) {
      throw new Error(`PROGRAM_NOT_FOUND: ${programId}`);
    }
    if (applicant.householdSize < 1) {
      throw new Error('INVALID_APPLICANT: householdSize >= 1');
    }

    const incomeOk = applicant.income <= program.incomeCap;
    const ageOk = applicant.age >= program.minAge;
    const eligible = incomeOk && ageOk;

    let amount = 0;
    let reason = '';
    if (eligible) {
      amount = program.baseAmount + program.perMemberBonus * (applicant.householdSize - 1);
      reason = 'ELIGIBLE';
    } else if (!incomeOk && !ageOk) {
      reason = 'INCOME_AND_AGE';
    } else if (!incomeOk) {
      reason = 'INCOME_OVER_CAP';
    } else {
      reason = 'AGE_UNDER_MIN';
    }

    this.record('EVALUATE', programId, { eligible, amount });
    return { programId, eligible, amount, reason };
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
