// SVC-AI-ADV-R439 Open Data Quality Manager AI
// Design Ref: SVC-AI-ADV-R439.design.md
// Plan SC: FR-439.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Grade = 'A' | 'B' | 'C' | 'D';

export interface DatasetStats {
  readonly datasetId: string;
  readonly totalRows: number;
  readonly nullCount: number;
  readonly invalidCount: number;
  readonly schemaViolations: number;
  readonly lastUpdated: string;
}

export interface Scorecard {
  readonly datasetId: string;
  readonly completeness: number;
  readonly freshness: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly overall: number;
  readonly grade: Grade;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class OpenDataQualityManagerAI {
  private readonly auditLog: AuditEntry[] = [];

  score(stats: DatasetStats, grade: DataGrade = 'O'): Scorecard {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 데이터 차단 (N2SF N-05)`);
    }
    if (stats.totalRows <= 0) throw new Error('INVALID_ROWS');

    const completeness = Number((1 - stats.nullCount / stats.totalRows).toFixed(4));
    const accuracy = Number((1 - stats.invalidCount / stats.totalRows).toFixed(4));
    const consistency = Number((1 - stats.schemaViolations / stats.totalRows).toFixed(4));

    const lastMs = new Date(stats.lastUpdated).getTime();
    const days = Number.isFinite(lastMs) ? (Date.now() - lastMs) / (1000 * 60 * 60 * 24) : 9999;
    let freshness: number;
    if (days <= 30) freshness = 1;
    else if (days <= 90) freshness = 0.6;
    else freshness = 0.3;

    const overall = Number(
      (0.3 * completeness + 0.2 * freshness + 0.3 * accuracy + 0.2 * consistency).toFixed(4),
    );

    let g: Grade;
    if (overall >= 0.9) g = 'A';
    else if (overall >= 0.7) g = 'B';
    else if (overall >= 0.5) g = 'C';
    else g = 'D';

    this.record('SCORE', stats.datasetId, { overall, grade: g });
    return {
      datasetId: stats.datasetId,
      completeness: Math.max(0, completeness),
      freshness,
      accuracy: Math.max(0, accuracy),
      consistency: Math.max(0, consistency),
      overall,
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
