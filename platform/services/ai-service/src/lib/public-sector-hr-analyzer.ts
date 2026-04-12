// SVC-AI-ADV-R357 Public Sector HR Analyzer
// Design Ref: SVC-AI-ADV-R357.design.md
// Plan SC: SC-R357-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface HrRecord {
  readonly employeeId: string;
  readonly deptId: string;
  readonly grade: DataGrade;
  readonly skillScore: number;
  readonly performance: number;
  readonly tenureYears: number;
  readonly trainingHours: number;
  readonly absenceDays: number;
  readonly salaryPercentile: number;
}

export interface HrAnalysis {
  readonly employeeId: string;
  readonly gap: number;
  readonly turnoverRisk: number;
  readonly flags: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicSectorHrAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(records: readonly HrRecord[]): readonly HrAnalysis[] {
    for (const record of records) {
      if (record.grade === 'C' || record.grade === 'S') {
        throw new Error(`N2SF_BLOCKED: ${record.grade}등급 인사 상세 데이터 차단 (N2SF N-05)`);
      }
    }

    const deptSum = new Map<string, { total: number; count: number }>();
    for (const record of records) {
      const entry = deptSum.get(record.deptId) ?? { total: 0, count: 0 };
      entry.total += record.skillScore;
      entry.count += 1;
      deptSum.set(record.deptId, entry);
    }

    const result: HrAnalysis[] = [];
    for (const record of records) {
      const stats = deptSum.get(record.deptId);
      const average = stats && stats.count > 0 ? stats.total / stats.count : record.skillScore;
      const gap = Number((average - record.skillScore).toFixed(2));

      let risk = 0;
      const flags: string[] = [];
      if (record.performance < 3) {
        risk += 30;
        flags.push('LOW_PERFORMANCE');
      }
      if (record.tenureYears < 2) {
        risk += 20;
        flags.push('SHORT_TENURE');
      }
      if (record.trainingHours < 10) {
        risk += 15;
        flags.push('LOW_TRAINING');
      }
      if (record.absenceDays > 10) {
        risk += 25;
        flags.push('HIGH_ABSENCE');
      }
      if (record.salaryPercentile < 40) {
        risk += 10;
        flags.push('LOW_SALARY');
      }

      result.push({
        employeeId: record.employeeId,
        gap,
        turnoverRisk: Math.min(100, risk),
        flags,
      });
    }

    this.record('ANALYZE', 'hr', { count: records.length });
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
