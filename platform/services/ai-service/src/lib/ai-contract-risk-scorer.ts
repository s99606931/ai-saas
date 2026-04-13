// SVC-AI-ADV-R401 AI Contract Risk Scorer
// Design Ref: SVC-AI-ADV-R401.design.md
// Plan SC: SC-R401-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type RiskGrade = 'low' | 'med' | 'high';

const CRITICAL_KW = ['무한책임', '즉시해지', '전액배상'];
const HIGH_KW = ['위약금', '일방해지', '지연배상'];
const MED_KW = ['지체상금', '검수지연'];

export interface ClauseScore {
  readonly clauseId: string;
  readonly score: number;
  readonly critical: number;
  readonly high: number;
  readonly med: number;
}

export interface ContractRiskReport {
  readonly contractId: string;
  readonly clauses: readonly ClauseScore[];
  readonly overallScore: number;
  readonly grade: RiskGrade;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AIContractRiskScorer {
  private readonly auditLog: AuditEntry[] = [];

  score(
    contractId: string,
    clauses: readonly { id: string; text: string }[],
    grade: DataGrade = 'O',
  ): ContractRiskReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 계약 데이터 차단 (N2SF N-05)`);
    }
    if (clauses.length === 0) {
      throw new Error('INVALID_INPUT: 조항 최소 1개 필요');
    }

    const clauseScores: ClauseScore[] = clauses.map((c) => {
      const cCount = this.countAny(c.text, CRITICAL_KW);
      const hCount = this.countAny(c.text, HIGH_KW);
      const mCount = this.countAny(c.text, MED_KW);
      const rawScore = cCount * 40 + hCount * 25 + mCount * 10;
      const scoreVal = Math.min(100, rawScore);
      return { clauseId: c.id, score: scoreVal, critical: cCount, high: hCount, med: mCount };
    });

    const overall = Number(
      (clauseScores.reduce((s, x) => s + x.score, 0) / clauseScores.length).toFixed(2),
    );

    let gradeVal: RiskGrade;
    if (overall >= 70) gradeVal = 'high';
    else if (overall >= 40) gradeVal = 'med';
    else gradeVal = 'low';

    const report: ContractRiskReport = {
      contractId,
      clauses: clauseScores,
      overallScore: overall,
      grade: gradeVal,
    };

    this.record('SCORE', contractId, { overall, grade: gradeVal });
    return report;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private countAny(text: string, keywords: readonly string[]): number {
    return keywords.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
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
