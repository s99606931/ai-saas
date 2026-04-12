// MTU-N314 성능 평가 테스트
import { describe, it, expect } from 'vitest';
import { PerformanceEvaluatorService } from '../performance-evaluator.js';

describe('MTU-N314 PerformanceEvaluator', () => {
  const svc = new PerformanceEvaluatorService('tenant-n314');

  it('FR-N314.1: 성능 평가', () => {
    const metrics = [
      { metricId: 'm1', name: 'uptime', target: 99.9, actual: 99.95, weight: 50, unit: '%' },
      { metricId: 'm2', name: 'latency', target: 100, actual: 80, weight: 50, unit: 'ms' },
    ];
    const result = svc.evaluate('2026-Q1', metrics);
    expect(result).toBeDefined();
    expect(['S', 'A', 'B', 'C', 'D']).toContain(result.grade);
  });

  it('FR-N314.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
