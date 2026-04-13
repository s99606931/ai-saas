// SVC-AI-ADV-R428 Citizen Engagement Analyzer
// Design Ref: SVC-AI-ADV-R428.design.md
// Plan SC: FR-428.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type EngagementGrade = 'LOW' | 'MID' | 'HIGH';

export interface EngagementInput {
  readonly policyId: string;
  readonly participants: number;
  readonly targetPopulation: number;
  readonly satisfaction: number; // 0~100
}

export interface EngagementResult {
  readonly policyId: string;
  readonly participationRate: number;
  readonly responseScore: number;
  readonly engagementIndex: number;
  readonly grade: EngagementGrade;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class CitizenEngagementAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(input: EngagementInput, grade: DataGrade = 'O'): EngagementResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 참여 데이터 차단 (N2SF N-05)`);
    }
    if (input.targetPopulation <= 0) {
      throw new Error('INVALID_TARGET_POPULATION');
    }
    if (input.satisfaction < 0 || input.satisfaction > 100) {
      throw new Error('INVALID_SATISFACTION');
    }

    const participationRate = Number(
      Math.min(1, input.participants / input.targetPopulation).toFixed(4),
    );
    const responseScore = Number(Math.min(100, participationRate * 100).toFixed(2));
    const engagementIndex = Number((responseScore * 0.5 + input.satisfaction * 0.5).toFixed(2));

    let g: EngagementGrade;
    if (engagementIndex < 40) g = 'LOW';
    else if (engagementIndex < 70) g = 'MID';
    else g = 'HIGH';

    this.record('ANALYZE', input.policyId, { engagementIndex, grade: g });
    return {
      policyId: input.policyId,
      participationRate,
      responseScore,
      engagementIndex,
      grade: g,
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
