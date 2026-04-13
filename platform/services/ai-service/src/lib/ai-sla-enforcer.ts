// SVC-AI-ADV-R404 AI-Based SLA Enforcer
// Design Ref: SVC-AI-ADV-R404.design.md
// Plan SC: SC-R404-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type EscalationLevel = 'none' | 'L1' | 'L2' | 'L3';

export interface SlaInput {
  readonly slaId: string;
  readonly target: number;
  readonly actual: number;
  readonly basePenalty: number;
}

export interface EnforceResult {
  readonly slaId: string;
  readonly violationRatio: number;
  readonly penalty: number;
  readonly level: EscalationLevel;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AISlaEnforcer {
  private readonly auditLog: AuditEntry[] = [];

  enforce(input: SlaInput, grade: DataGrade = 'O'): EnforceResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 SLA 데이터 차단 (N2SF N-05)`);
    }
    if (input.target <= 0) {
      throw new Error('INVALID_TARGET: target > 0');
    }
    if (input.basePenalty < 0) {
      throw new Error('INVALID_BASE_PENALTY: >=0');
    }

    const rawRatio = (input.target - input.actual) / input.target;
    const violationRatio = Number(Math.max(0, Math.min(1, rawRatio)).toFixed(4));
    const penalty = Number((input.basePenalty * violationRatio).toFixed(2));

    let level: EscalationLevel;
    if (violationRatio === 0) level = 'none';
    else if (violationRatio < 0.15) level = 'L1';
    else if (violationRatio < 0.30) level = 'L2';
    else level = 'L3';

    const result: EnforceResult = {
      slaId: input.slaId,
      violationRatio,
      penalty,
      level,
    };
    this.record('ENFORCE', input.slaId, { violationRatio, penalty, level });
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
