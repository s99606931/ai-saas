// SVC-AI-ADV-R442 공공 보건 트렌드 분석기
// Design Ref: SVC-AI-ADV-R442.design.md
// Plan SC: FR-442.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface TrendInput {
  readonly category: string;
  readonly weeks: readonly number[];
}

export interface TrendReport {
  readonly category: string;
  readonly spikes: readonly number[];
  readonly growthPct: number;
  readonly status: 'SPIKE' | 'STABLE';
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicHealthTrendAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(input: TrendInput, grade: DataGrade = 'O'): TrendReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 보건 데이터 차단 (N2SF N-05)`);
    }
    if (!input.category) throw new Error('INVALID_CATEGORY');
    const w = input.weeks;
    if (w.length < 2) throw new Error('INSUFFICIENT_WEEKS: 최소 2주');
    for (const v of w) if (v < 0) throw new Error('NEGATIVE_VALUE');

    const spikes: number[] = [];
    for (let i = 3; i < w.length; i++) {
      const ma = (w[i - 3]! + w[i - 2]! + w[i - 1]! + w[i]!) / 4;
      if (ma > 0 && w[i]! / ma >= 1.5) spikes.push(i);
    }

    const first = w[0]!;
    const last = w[w.length - 1]!;
    const growthPct =
      first === 0 ? 0 : Number((((last - first) / first) * 100).toFixed(2));

    const status: 'SPIKE' | 'STABLE' = spikes.length > 0 ? 'SPIKE' : 'STABLE';
    this.record('ANALYZE', input.category, {
      weeks: w.length,
      spikes: spikes.length,
      growthPct,
      status,
    });
    return { category: input.category, spikes, growthPct, status };
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
