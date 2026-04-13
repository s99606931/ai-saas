// SVC-AI-ADV-R494 Data Quality Governance AI
// Design Ref: SVC-AI-ADV-R494.design.md §데이터품질거버넌스
// Plan SC: FR-494.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type Dimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'validity';

export interface DatasetStats {
  readonly datasetId: string;
  readonly totalRows: number;
  readonly missingValues: number;
  readonly invalidValues: number;
  readonly duplicateRows: number;
  readonly staleDays: number;
  readonly schemaViolations: number;
}

export interface QualityScore {
  readonly datasetId: string;
  readonly dimensions: Readonly<Record<Dimension, number>>;
  readonly overall: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly issues: readonly string[];
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

function pct(numer: number, denom: number): number {
  if (denom <= 0) return 100;
  const v = ((denom - numer) / denom) * 100;
  return Math.max(0, Math.min(100, Math.round(v * 100) / 100));
}

export class DataQualityGovernanceAi {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(stats: DatasetStats, grade: DataGrade = 'O'): QualityScore {
    blockClassifiedData(grade);
    if (stats.totalRows < 0) {
      throw new Error('VALIDATION: totalRows 음수 불가');
    }

    const completeness = pct(stats.missingValues, stats.totalRows);
    const accuracy = pct(stats.invalidValues, stats.totalRows);
    const uniqueness = pct(stats.duplicateRows, stats.totalRows);
    const validity = pct(stats.schemaViolations, stats.totalRows);
    const consistency = (accuracy + validity) / 2;
    const timeliness =
      stats.staleDays <= 1
        ? 100
        : stats.staleDays <= 7
          ? 90
          : stats.staleDays <= 30
            ? 70
            : stats.staleDays <= 90
              ? 50
              : 20;

    const dimensions: Record<Dimension, number> = {
      completeness,
      accuracy,
      consistency: Math.round(consistency * 100) / 100,
      timeliness,
      uniqueness,
      validity,
    };

    const overall =
      (completeness + accuracy + consistency + timeliness + uniqueness + validity) / 6;
    const overallRounded = Math.round(overall * 100) / 100;

    const grade2: QualityScore['grade'] =
      overallRounded >= 95
        ? 'A'
        : overallRounded >= 85
          ? 'B'
          : overallRounded >= 70
            ? 'C'
            : overallRounded >= 50
              ? 'D'
              : 'F';

    const issues: string[] = [];
    if (completeness < 90) issues.push('high_missing_values');
    if (accuracy < 90) issues.push('invalid_data');
    if (uniqueness < 95) issues.push('duplicate_records');
    if (timeliness < 70) issues.push('stale_data');
    if (validity < 90) issues.push('schema_violations');

    const score: QualityScore = {
      datasetId: stats.datasetId,
      dimensions,
      overall: overallRounded,
      grade: grade2,
      issues,
    };

    this.appendAudit('EVALUATE', {
      datasetId: stats.datasetId,
      overall: overallRounded,
      grade: grade2,
    });
    return score;
  }

  recommendActions(score: QualityScore): readonly string[] {
    const actions: string[] = [];
    for (const issue of score.issues) {
      switch (issue) {
        case 'high_missing_values':
          actions.push('imputation_pipeline');
          break;
        case 'invalid_data':
          actions.push('data_validation_rules');
          break;
        case 'duplicate_records':
          actions.push('deduplication_job');
          break;
        case 'stale_data':
          actions.push('refresh_schedule_increase');
          break;
        case 'schema_violations':
          actions.push('schema_enforcement');
          break;
      }
    }
    if (actions.length === 0) actions.push('continuous_monitoring');
    return actions;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
