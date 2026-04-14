import { describe, it, expect, beforeEach } from 'vitest';
import { ApiPerformanceOptimizerV3, type ApiMetric } from '../api-performance-optimizer-v3';

describe('ApiPerformanceOptimizerV3', () => {
  let optimizer: ApiPerformanceOptimizerV3;

  beforeEach(() => {
    optimizer = new ApiPerformanceOptimizerV3();
  });

  it('classifies CRITICAL when p99>2000', () => {
    const metrics: ApiMetric[] = [
      { apiId: 'A1', avgResponseMs: 500, p99ResponseMs: 2500, errorRate: 0.01, callsPerMin: 100 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.status).toBe('CRITICAL');
    expect(result[0]!.recommendations).toContain('CACHE');
    expect(result[0]!.recommendations).toContain('RATE_LIMIT');
  });

  it('classifies CRITICAL when errorRate>0.05', () => {
    const metrics: ApiMetric[] = [
      { apiId: 'A2', avgResponseMs: 200, p99ResponseMs: 800, errorRate: 0.08, callsPerMin: 200 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.status).toBe('CRITICAL');
  });

  it('classifies WARNING when p99>1000', () => {
    const metrics: ApiMetric[] = [
      { apiId: 'A3', avgResponseMs: 300, p99ResponseMs: 1500, errorRate: 0.005, callsPerMin: 50 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.status).toBe('WARNING');
    expect(result[0]!.recommendations).toContain('CACHE');
    expect(result[0]!.recommendations).not.toContain('RATE_LIMIT');
  });

  it('classifies HEALTHY when p99<=1000 and errorRate<=0.01', () => {
    const metrics: ApiMetric[] = [
      { apiId: 'A4', avgResponseMs: 100, p99ResponseMs: 500, errorRate: 0.005, callsPerMin: 300 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.status).toBe('HEALTHY');
    expect(result[0]!.recommendations).toHaveLength(0);
  });

  it('computes score correctly', () => {
    const metrics: ApiMetric[] = [
      { apiId: 'A5', avgResponseMs: 100, p99ResponseMs: 0, errorRate: 0, callsPerMin: 100 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.score).toBe(100);
  });

  it('records audit log', () => {
    optimizer.optimize([
      { apiId: 'A6', avgResponseMs: 200, p99ResponseMs: 600, errorRate: 0.002, callsPerMin: 50 },
    ]);
    const log = optimizer.getAuditLog();
    expect(log[0]!.action).toBe('api.optimize');
  });
});
