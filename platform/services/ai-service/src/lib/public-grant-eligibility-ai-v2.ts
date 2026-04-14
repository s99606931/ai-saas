// Design Ref: SVC-AI-ADV-R683.design.md — AI기반 공공 보조금 자격 심사 v2
// Plan SC: FR-R683.1~5

import { createHash } from 'crypto';

export type GrantVerdict = 'ELIGIBLE' | 'REVIEW' | 'REJECTED';

export interface GrantProgram {
  programId: string;
  minScore: number;
  incomeCap: number;
}

export interface GrantApplication {
  applicationId: string;
  programId: string;
  applicantId: string;
  needIndex: number;
  impactScore: number;
  income: number;
}

export interface GrantResult {
  applicationId: string;
  programId: string;
  maskedApplicantId: string;
  score: number;
  verdict: GrantVerdict;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class PublicGrantEligibilityAIV2 {
  private readonly programs = new Map<string, GrantProgram>();
  private readonly auditLog: AuditEntry[] = [];

  defineProgram(program: GrantProgram): void {
    if (program.minScore < 0 || program.minScore > 1) {
      throw new Error('INVALID_MIN_SCORE');
    }
    if (program.incomeCap < 0) {
      throw new Error('INVALID_INCOME_CAP');
    }
    this.programs.set(program.programId, program);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DEFINE_PROGRAM',
      details: { programId: program.programId, minScore: program.minScore },
    });
  }

  assess(app: GrantApplication, dataGrade?: string): GrantResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const program = this.programs.get(app.programId);
    if (!program) {
      throw new Error(`UNKNOWN_PROGRAM: ${app.programId}`);
    }
    if (app.needIndex < 0 || app.needIndex > 1) {
      throw new Error('INVALID_NEED_INDEX');
    }
    if (app.impactScore < 0 || app.impactScore > 1) {
      throw new Error('INVALID_IMPACT_SCORE');
    }

    const maskedApplicantId = maskPII(app.applicantId);
    const score = Number((app.needIndex * 0.5 + app.impactScore * 0.5).toFixed(4));

    let verdict: GrantVerdict;
    let reason: string;
    if (app.income > program.incomeCap) {
      verdict = 'REJECTED';
      reason = `income ${app.income} > cap ${program.incomeCap}`;
    } else if (score >= program.minScore) {
      verdict = 'ELIGIBLE';
      reason = `score ${score} >= min ${program.minScore}`;
    } else if (score >= program.minScore - 0.15) {
      verdict = 'REVIEW';
      reason = `score ${score} within margin`;
    } else {
      verdict = 'REJECTED';
      reason = `score ${score} < min ${program.minScore}`;
    }

    const result: GrantResult = {
      applicationId: app.applicationId,
      programId: app.programId,
      maskedApplicantId,
      score,
      verdict,
      reason,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ASSESS',
      details: {
        applicationId: app.applicationId,
        programId: app.programId,
        maskedApplicantId,
        verdict,
      },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
