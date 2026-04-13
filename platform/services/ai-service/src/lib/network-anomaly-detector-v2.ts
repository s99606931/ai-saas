// Design Ref: §SVC-AI-ADV-R450 — 공공 서비스 품질 벤치마크 AI
// Plan SC: FR-R450.1~5

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

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class ServiceQualityBenchmark {
  private readonly auditLog: AuditEvent[] = [];

  private computeScore(m: Metrics): number {
    // Equal weights across 4 metrics, each 0~100
    return (m.satisfaction + m.response + m.coverage + m.transparency) / 4;
  }

  benchmark(agencies: readonly Agency[]): BenchmarkReport {
    if (agencies.length === 0) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'benchmark.run',
        details: { agencyCount: 0 },
      });
      return { rankings: [], average: 0 };
    }

    const scored = agencies
      .map(a => ({ id: a.id, score: Math.round(this.computeScore(a.metrics) * 10) / 10 }))
      .sort((a, b) => b.score - a.score);

    const rankings: Ranked[] = scored.map((s, i) => ({ id: s.id, score: s.score, rank: i + 1 }));
    const average = Math.round((scored.reduce((sum, s) => sum + s.score, 0) / scored.length) * 10) / 10;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'benchmark.run',
      details: {
        agencyCount: agencies.length,
        average,
        topAgency: rankings[0]!.id,
      },
    });

    return { rankings, average };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
