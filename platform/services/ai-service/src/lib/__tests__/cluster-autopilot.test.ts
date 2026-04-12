import { describe, it, expect } from 'vitest';
import { ClusterAutopilot, type NodeUsageSample } from '../cluster-autopilot';

describe('ClusterAutopilot', () => {
  const svc = new ClusterAutopilot();

  const samples: NodeUsageSample[] = [
    { nodeId: 'n1', cpuPct: 30, memPct: 40, timestamp: '2026-04-11T00:00:00Z' },
    { nodeId: 'n1', cpuPct: 40, memPct: 50, timestamp: '2026-04-11T01:00:00Z' },
    { nodeId: 'n1', cpuPct: 50, memPct: 60, timestamp: '2026-04-11T02:00:00Z' },
  ];

  it('FR-CAP.1 사용량 예측', () => {
    const f = svc.forecastUsage(samples);
    expect(f.cpuAvg).toBe(40);
    expect(f.memAvg).toBe(50);
  });

  it('FR-CAP.2 scale out', () => {
    const r = svc.recommendScaling('api', 3, 90);
    expect(r.recommendedReplicas).toBeGreaterThan(3);
  });

  it('FR-CAP.2 scale in', () => {
    const r = svc.recommendScaling('api', 10, 20);
    expect(r.recommendedReplicas).toBeLessThan(10);
  });

  it('FR-CAP.3 pod 배치', () => {
    const nodes: NodeUsageSample[] = [
      { nodeId: 'n1', cpuPct: 80, memPct: 80, timestamp: '' },
      { nodeId: 'n2', cpuPct: 20, memPct: 20, timestamp: '' },
    ];
    const p = svc.placePods('pod-x', nodes);
    expect(p.targetNode).toBe('n2');
  });

  it('FR-CAP.4 spot 추천', () => {
    const r = svc.recommendSpot('batch', false, 0.1);
    expect(r.spotEligible).toBe(true);
    expect(r.estimatedSavingsPct).toBe(70);
  });

  it('FR-CAP.5 대시보드 데이터', () => {
    const data = svc.buildDashboardData(samples);
    expect(data.length).toBe(3);
  });
});
