// SVC-AI-ADV-R456 지자체 부채 위험도 평가기
// Design Ref: SVC-AI-ADV-R456.design.md
// Plan SC: FR-456.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Grade = 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export interface Finance {
  readonly region: string;
  readonly debtRatio: number;
  readonly repaymentRatio: number;
  readonly reserveRatio: number;
}

export interface Assessment {
  readonly region: string;
  readonly score: number;
  readonly grade: Grade;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicDebtRiskAssessor {
  private readonly auditLog: AuditEntry[] = [];

  assess(finances: readonly Finance[], grade: DataGrade = 'O'): readonly Assessment[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 재정 데이터 차단 (N2SF N-05)`);
    }

    const results: Assessment[] = [];
    for (const f of finances) {
      if (!f.region) throw new Error('INVALID_REGION');
      this.assertRange(f.debtRatio, 'debtRatio', f.region);
      this.assertRange(f.repaymentRatio, 'repaymentRatio', f.region);
      this.assertRange(f.reserveRatio, 'reserveRatio', f.region);

      const score =
        f.debtRatio * 0.5 + f.repaymentRatio * 0.3 + (1 - f.reserveRatio) * 0.2;
      const rounded = Math.round(score * 1000) / 1000;
      const g: Grade =
        rounded >= 0.7
          ? 'CRITICAL'
          : rounded >= 0.5
            ? 'WARNING'
            : rounded >= 0.3
              ? 'CAUTION'
              : 'SAFE';

      results.push({ region: f.region, score: rounded, grade: g });
    }

    this.record('ASSESS', 'debt', { count: results.length });
    return results;
  }

  private assertRange(v: number, field: string, region: string): void {
    if (v < 0 || v > 1) throw new Error(`INVALID_${field.toUpperCase()}: ${region}`);
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
