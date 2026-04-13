// SVC-AI-ADV-R452 공공 데이터 이상치 감지기
// Design Ref: SVC-AI-ADV-R452.design.md
// Plan SC: FR-452.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type Bound = 'LOW' | 'HIGH';

export interface Dataset {
  readonly datasetId: string;
  readonly values: readonly number[];
}

export interface Outlier {
  readonly index: number;
  readonly value: number;
  readonly bound: Bound;
  readonly recommended: number;
}

export interface OutlierResult {
  readonly datasetId: string;
  readonly q1: number;
  readonly q3: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly outliers: readonly Outlier[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicDataOutlierDetector {
  private readonly auditLog: AuditEntry[] = [];

  detect(dataset: Dataset, grade: DataGrade = 'O'): OutlierResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 데이터셋 차단 (N2SF N-05)`);
    }
    if (!dataset.datasetId) throw new Error('INVALID_DATASET_ID');

    if (dataset.values.length === 0) {
      this.record('DETECT', dataset.datasetId, { outliers: 0 });
      return {
        datasetId: dataset.datasetId,
        q1: 0,
        q3: 0,
        lowerBound: 0,
        upperBound: 0,
        outliers: [],
      };
    }

    const sorted = [...dataset.values].sort((a, b) => a - b);
    const q1 = this.quantile(sorted, 0.25);
    const q3 = this.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: Outlier[] = [];
    for (let i = 0; i < dataset.values.length; i++) {
      const v = dataset.values[i]!;
      if (v < lowerBound) {
        outliers.push({ index: i, value: v, bound: 'LOW', recommended: q1 });
      } else if (v > upperBound) {
        outliers.push({ index: i, value: v, bound: 'HIGH', recommended: q3 });
      }
    }

    this.record('DETECT', dataset.datasetId, { outliers: outliers.length });
    return {
      datasetId: dataset.datasetId,
      q1,
      q3,
      lowerBound,
      upperBound,
      outliers,
    };
  }

  private quantile(sorted: readonly number[], q: number): number {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    if (next !== undefined) {
      return sorted[base]! + rest * (next - sorted[base]!);
    }
    return sorted[base]!;
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
