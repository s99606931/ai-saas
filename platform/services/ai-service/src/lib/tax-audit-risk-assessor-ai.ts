// SVC-AI-ADV-R435 Tax Audit Risk Assessor AI
// Design Ref: SVC-AI-ADV-R435.design.md
// Plan SC: FR-435.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Taxpayer {
  readonly taxpayerId: string;
  readonly cashRatio: number;
  readonly reportGap: number;
  readonly industryRisk: number;
}

export interface RiskAssessment {
  readonly taxpayerId: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly topFactors: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class TaxAuditRiskAssessorAI {
  private readonly auditLog: AuditEntry[] = [];

  assess(payers: readonly Taxpayer[], grade: DataGrade = 'O'): readonly RiskAssessment[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 세무 데이터 차단 (N2SF N-05)`);
    }

    const weights = { cashRatio: 0.4, reportGap: 0.3, industryRisk: 0.3 };
    const results: RiskAssessment[] = payers.map((p) => {
      this.validateRange(p.cashRatio, 'cashRatio');
      this.validateRange(p.reportGap, 'reportGap');
      this.validateRange(p.industryRisk, 'industryRisk');

      const score = Number(
        (
          weights.cashRatio * p.cashRatio +
          weights.reportGap * p.reportGap +
          weights.industryRisk * p.industryRisk
        ).toFixed(4),
      );
      let level: RiskLevel;
      if (score >= 0.7) level = 'HIGH';
      else if (score >= 0.4) level = 'MEDIUM';
      else level = 'LOW';

      const contrib: Array<[string, number]> = [
        ['cashRatio', weights.cashRatio * p.cashRatio],
        ['reportGap', weights.reportGap * p.reportGap],
        ['industryRisk', weights.industryRisk * p.industryRisk],
      ];
      contrib.sort((a, b) => b[1] - a[1]);
      const topFactors = contrib.slice(0, 2).map(([k]) => k);

      return { taxpayerId: p.taxpayerId, score, level, topFactors };
    });

    const rank: Record<RiskLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sorted = [...results].sort((a, b) => {
      if (rank[a.level] !== rank[b.level]) return rank[b.level] - rank[a.level];
      return b.score - a.score;
    });

    this.record('ASSESS', 'batch', { count: sorted.length });
    return sorted;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private validateRange(v: number, name: string): void {
    if (!(v >= 0 && v <= 1)) {
      throw new Error(`INVALID_RANGE: ${name}=${v}`);
    }
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
