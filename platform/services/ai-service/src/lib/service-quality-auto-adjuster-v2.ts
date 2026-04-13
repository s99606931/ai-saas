// Design Ref: §SVC-AI-ADV-R456 — 지자체 부채 위험도 평가기
// Plan SC: FR-R456.1~5

export interface Finance {
  readonly region: string;
  readonly debtRatio: number;
  readonly repaymentRatio: number;
  readonly reserveRatio: number;
}

export type Grade = 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export interface Assessment {
  readonly region: string;
  readonly score: number;
  readonly grade: Grade;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class MunicipalDebtRiskAssessor {
  private readonly auditLog: AuditEvent[] = [];

  private computeScore(f: Finance): number {
    // Higher debtRatio and repaymentRatio → worse; higher reserveRatio → better
    // score 0~100: higher = more risky
    const debtScore = Math.min(f.debtRatio * 100, 100);       // debt/total asset ratio, 0~1 scale
    const repayScore = Math.min(f.repaymentRatio * 100, 100); // debt service / revenue
    const reserveScore = Math.max(100 - f.reserveRatio * 100, 0); // low reserve = risk
    return Math.round((debtScore * 0.4 + repayScore * 0.4 + reserveScore * 0.2) * 10) / 10;
  }

  private gradeFromScore(score: number): Grade {
    if (score < 25) return 'SAFE';
    if (score < 50) return 'CAUTION';
    if (score < 75) return 'WARNING';
    return 'CRITICAL';
  }

  assess(finances: readonly Finance[]): readonly Assessment[] {
    const assessments: Assessment[] = finances.map(f => {
      const score = this.computeScore(f);
      const grade = this.gradeFromScore(score);
      return { region: f.region, score, grade };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'debt.assess',
      details: {
        regionCount: finances.length,
        criticalCount: assessments.filter(a => a.grade === 'CRITICAL').length,
        warningCount: assessments.filter(a => a.grade === 'WARNING').length,
      },
    });

    return assessments;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
