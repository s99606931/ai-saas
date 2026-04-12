// MTU-N291 FinOps 용량 계획 테스트
import { describe, it, expect } from 'vitest';
import {
  forecastCapacity,
  optimizeCost,
  generateFinOpsReport,
  FinOpsCapacityPlanningService,
  type ResourceMetric,
} from '../finops-capacity-planning.js';

describe('MTU-N291 FinOpsCapacityPlanning', () => {
  const tenantId = 'tenant-n291';

  function buildMetrics(resourceId: string, values: number[]): ResourceMetric[] {
    const start = new Date('2026-04-01T00:00:00Z').getTime();
    return values.map((v, i) => ({
      resourceId,
      type: 'cpu' as const,
      timestamp: new Date(start + i * 3600 * 1000).toISOString(),
      value: v,
      costKrw: 1000,
    }));
  }

  it('FR-N291.1: 용량 예측 (증가 추세 → scale_up)', () => {
    const metrics = buildMetrics('vm-1', [50, 55, 60, 65, 70, 75, 82, 88, 92, 95]);
    const f = forecastCapacity(metrics);
    expect(f).not.toBeNull();
    expect(f!.recommendedAction).toBe('scale_up');
    expect(f!.confidence).toBeGreaterThan(0.5);
  });

  it('FR-N291.1: 저사용 → scale_down', () => {
    const metrics = buildMetrics('vm-2', [10, 12, 15, 8, 10, 12, 9, 11, 10, 9]);
    const f = forecastCapacity(metrics);
    expect(f!.recommendedAction).toBe('scale_down');
  });

  it('FR-N291.2: 비용 최적화 (저사용)', () => {
    const metrics = buildMetrics('vm-3', [10, 12, 15, 10]);
    const o = optimizeCost(metrics);
    expect(o).not.toBeNull();
    expect(o!.recommendation).toContain('다운사이징');
    expect(o!.savingsKrw).toBeGreaterThan(0);
  });

  it('FR-N291.3: 통합 리포트', () => {
    const map = new Map([
      ['vm-1', buildMetrics('vm-1', [60, 70, 80, 85, 90])],
      ['vm-2', buildMetrics('vm-2', [10, 15, 12, 8])],
    ]);
    const r = generateFinOpsReport(tenantId, 'u1', map);
    expect(r.reportId).toMatch(/^finops-/);
    expect(r.forecasts.length).toBe(2);
    expect(r.optimizations.length).toBe(2);
  });

  it('FR-N291.6: Service + 감사', () => {
    const svc = new FinOpsCapacityPlanningService('tenant-svc-n291');
    const map = new Map([['vm-x', buildMetrics('vm-x', [40, 42, 45, 48])]]);
    svc.report(map);
    expect(svc.audit().length).toBeGreaterThan(0);
  });
});
