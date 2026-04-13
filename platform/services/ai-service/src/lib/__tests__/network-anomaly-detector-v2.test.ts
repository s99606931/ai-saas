import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceQualityBenchmark, type Agency } from '../network-anomaly-detector-v2';

describe('ServiceQualityBenchmark', () => {
  let benchmark: ServiceQualityBenchmark;

  beforeEach(() => {
    benchmark = new ServiceQualityBenchmark();
  });

  it('ranks agencies by composite score descending', () => {
    const agencies: Agency[] = [
      { id: 'A1', metrics: { satisfaction: 80, response: 70, coverage: 60, transparency: 90 } },
      { id: 'A2', metrics: { satisfaction: 90, response: 95, coverage: 85, transparency: 100 } },
    ];
    const report = benchmark.benchmark(agencies);
    expect(report.rankings[0]!.id).toBe('A2');
    expect(report.rankings[1]!.id).toBe('A1');
    expect(report.rankings[0]!.rank).toBe(1);
  });

  it('computes average correctly', () => {
    const agencies: Agency[] = [
      { id: 'B1', metrics: { satisfaction: 100, response: 100, coverage: 100, transparency: 100 } },
      { id: 'B2', metrics: { satisfaction: 0, response: 0, coverage: 0, transparency: 0 } },
    ];
    const report = benchmark.benchmark(agencies);
    expect(report.average).toBe(50);
  });

  it('handles single agency with rank 1', () => {
    const agencies: Agency[] = [
      { id: 'C1', metrics: { satisfaction: 75, response: 80, coverage: 70, transparency: 65 } },
    ];
    const report = benchmark.benchmark(agencies);
    expect(report.rankings[0]!.rank).toBe(1);
    expect(report.rankings[0]!.score).toBeCloseTo(72.5, 0);
  });

  it('returns empty result for no agencies', () => {
    const report = benchmark.benchmark([]);
    expect(report.rankings).toHaveLength(0);
    expect(report.average).toBe(0);
  });

  it('records audit log on benchmark', () => {
    benchmark.benchmark([
      { id: 'D1', metrics: { satisfaction: 80, response: 80, coverage: 80, transparency: 80 } },
    ]);
    const log = benchmark.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('benchmark.run');
  });

  it('assigns sequential ranks for multiple agencies', () => {
    const agencies: Agency[] = [
      { id: 'E1', metrics: { satisfaction: 50, response: 50, coverage: 50, transparency: 50 } },
      { id: 'E2', metrics: { satisfaction: 70, response: 70, coverage: 70, transparency: 70 } },
      { id: 'E3', metrics: { satisfaction: 90, response: 90, coverage: 90, transparency: 90 } },
    ];
    const report = benchmark.benchmark(agencies);
    const ranks = report.rankings.map(r => r.rank);
    expect(ranks).toEqual([1, 2, 3]);
  });
});
