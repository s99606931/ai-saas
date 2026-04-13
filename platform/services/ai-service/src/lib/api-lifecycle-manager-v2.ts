// Design Ref: §SVC-AI-ADV-R452 — 공공 데이터 이상치 감지기
// Plan SC: FR-R452.1~5

export interface Dataset {
  readonly datasetId: string;
  readonly values: readonly number[];
}

export type Bound = 'LOW' | 'HIGH';

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

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicDataOutlierDetector {
  private readonly auditLog: AuditEvent[] = [];

  private quantile(sorted: readonly number[], p: number): number {
    const n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return sorted[0]!;
    const h = p * (n - 1);
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    if (lo === hi) return sorted[lo]!;
    return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
  }

  detect(dataset: Dataset): OutlierResult {
    const sorted = [...dataset.values].sort((a, b) => a - b);
    const q1 = this.quantile(sorted, 0.25);
    const q3 = this.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: Outlier[] = dataset.values
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value < lowerBound || value > upperBound)
      .map(({ value, index }) => ({
        index,
        value,
        bound: value < lowerBound ? 'LOW' : 'HIGH',
        recommended: value < lowerBound ? Math.round(lowerBound * 100) / 100 : Math.round(upperBound * 100) / 100,
      }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'outlier.detect',
      details: {
        datasetId: dataset.datasetId,
        valueCount: dataset.values.length,
        outlierCount: outliers.length,
        q1: Math.round(q1 * 100) / 100,
        q3: Math.round(q3 * 100) / 100,
      },
    });

    return {
      datasetId: dataset.datasetId,
      q1: Math.round(q1 * 100) / 100,
      q3: Math.round(q3 * 100) / 100,
      lowerBound: Math.round(lowerBound * 100) / 100,
      upperBound: Math.round(upperBound * 100) / 100,
      outliers,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
