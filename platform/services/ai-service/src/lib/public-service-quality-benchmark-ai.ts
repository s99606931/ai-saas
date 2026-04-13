// SVC-AI-ADV-R450 공공 서비스 품질 벤치마크 AI
// Design Ref: SVC-AI-ADV-R450.design.md
// Plan SC: FR-450.1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Metrics {
  readonly satisfaction: number;
  readonly response: number;
  readonly coverage: number;
  readonly transparency: number;
}

export interface Agency {
  readonly id: string;
  readonly metrics: Metrics;
}

export interface Ranked {
  readonly id: string;
  readonly score: number;
  readonly rank: number;
}

export interface BenchmarkReport {
  readonly rankings: readonly Ranked[];
  readonly average: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const WEIGHTS = {
  satisfaction: 0.4,
  response: 0.2,
  coverage: 0.2,
  transparency: 0.2,
};

export class PublicServiceQualityBenchmarkAI {
  private readonly auditLog: AuditEntry[] = [];

  benchmark(agencies: readonly Agency[], grade: DataGrade = 'O'): BenchmarkReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 기관 데이터 차단 (N2SF N-05)`);
    }
    if (agencies.length === 0) return { rankings: [], average: 0 };

    for (const a of agencies) {
      if (!a.id) throw new Error('INVALID_AGENCY_ID');
      for (const [k, v] of Object.entries(a.metrics) as [keyof Metrics, number][]) {
        if (v < 0 || v > 100) throw new Error(`INVALID_METRIC: ${a.id}.${k}`);
      }
    }

    const scored = agencies.map((a) => {
      const score =
        a.metrics.satisfaction * WEIGHTS.satisfaction +
        a.metrics.response * WEIGHTS.response +
        a.metrics.coverage * WEIGHTS.coverage +
        a.metrics.transparency * WEIGHTS.transparency;
      return { id: a.id, score: Number(score.toFixed(2)), satisfaction: a.metrics.satisfaction };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.satisfaction - a.satisfaction;
    });

    const rankings: Ranked[] = scored.map((s, i) => ({
      id: s.id,
      score: s.score,
      rank: i + 1,
    }));

    const average = Number(
      (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(2),
    );

    this.record('BENCHMARK', 'agencies', {
      count: agencies.length,
      topId: rankings[0]?.id,
      average,
    });
    return { rankings, average };
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
