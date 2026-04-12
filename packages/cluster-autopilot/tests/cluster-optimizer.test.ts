/**
 * 클러스터 오토파일럿 테스트
 * Plan SC: FR-CAP.1~5
 */

import {
  ResourceForecaster,
  AutoscalingAdvisor,
  PodPlacementOptimizer,
  CostOptimizer,
} from '../src/cluster-optimizer';

describe('ResourceForecaster', () => {
  const f = new ResourceForecaster();

  it('상승 추세 → 미래 예측 증가', () => {
    const samples = [
      { nodeId: 'n1', timestamp: '', cpuUsagePercent: 30, memoryUsagePercent: 40, podCount: 5 },
      { nodeId: 'n1', timestamp: '', cpuUsagePercent: 40, memoryUsagePercent: 50, podCount: 5 },
      { nodeId: 'n1', timestamp: '', cpuUsagePercent: 50, memoryUsagePercent: 60, podCount: 5 },
    ];
    const result = f.forecast(samples, 1);
    expect(result[0]?.predictedCpuPercent).toBeGreaterThan(50);
  });

  it('샘플 1개면 무시', () => {
    const result = f.forecast(
      [{ nodeId: 'n1', timestamp: '', cpuUsagePercent: 50, memoryUsagePercent: 50, podCount: 5 }],
      1,
    );
    expect(result).toEqual([]);
  });

  it('100% 이상 클램프', () => {
    const samples = [
      { nodeId: 'n1', timestamp: '', cpuUsagePercent: 90, memoryUsagePercent: 90, podCount: 5 },
      { nodeId: 'n1', timestamp: '', cpuUsagePercent: 95, memoryUsagePercent: 95, podCount: 5 },
    ];
    const result = f.forecast(samples, 1000);
    expect(result[0]?.predictedCpuPercent).toBeLessThanOrEqual(100);
  });
});

describe('AutoscalingAdvisor', () => {
  const a = new AutoscalingAdvisor();

  it('HPA: utilization 70% 이상 → maxReplicas 10', () => {
    const r = a.recommendHpa({
      podName: 'p',
      namespace: 'n',
      requestedCpuMilli: 1000,
      requestedMemoryMi: 512,
      actualAvgCpuMilli: 800,
      actualAvgMemoryMi: 400,
    });
    expect(r.maxReplicas).toBe(10);
    expect(r.targetCpuPercent).toBe(70);
  });

  it('HPA: utilization 낮으면 maxReplicas 5', () => {
    const r = a.recommendHpa({
      podName: 'p',
      namespace: 'n',
      requestedCpuMilli: 1000,
      requestedMemoryMi: 512,
      actualAvgCpuMilli: 100,
      actualAvgMemoryMi: 100,
    });
    expect(r.maxReplicas).toBe(5);
  });

  it('VPA: 실사용의 1.3배 추천', () => {
    const r = a.recommendVpa({
      podName: 'p',
      namespace: 'n',
      requestedCpuMilli: 1000,
      requestedMemoryMi: 512,
      actualAvgCpuMilli: 100,
      actualAvgMemoryMi: 100,
    });
    expect(r.cpuMilli).toBe(130);
    expect(r.memoryMi).toBe(130);
  });
});

describe('PodPlacementOptimizer', () => {
  const o = new PodPlacementOptimizer();

  it('적합 노드 없음 → null', () => {
    const r = o.placePod(
      {
        podName: 'p',
        namespace: 'n',
        requestedCpuMilli: 10000,
        requestedMemoryMi: 50000,
        actualAvgCpuMilli: 0,
        actualAvgMemoryMi: 0,
      },
      [{ nodeId: 'n1', availableCpuMilli: 100, availableMemoryMi: 100, labels: {} }],
    );
    expect(r).toBeNull();
  });

  it('선호 라벨 일치 노드 우선', () => {
    const r = o.placePod(
      {
        podName: 'p',
        namespace: 'n',
        requestedCpuMilli: 100,
        requestedMemoryMi: 100,
        actualAvgCpuMilli: 50,
        actualAvgMemoryMi: 50,
      },
      [
        { nodeId: 'a', availableCpuMilli: 1000, availableMemoryMi: 1000, labels: {} },
        { nodeId: 'b', availableCpuMilli: 1000, availableMemoryMi: 1000, labels: { zone: 'kr' } },
      ],
      { zone: 'kr' },
    );
    expect(r?.nodeId).toBe('b');
  });
});

describe('CostOptimizer', () => {
  const c = new CostOptimizer();

  it('stateful → spot 거부', () => {
    const r = c.recommendSpot({ stateful: true, restartable: true, slaLevel: 'standard' });
    expect(r.useSpot).toBe(false);
  });

  it('non-restartable → spot 거부', () => {
    const r = c.recommendSpot({ stateful: false, restartable: false, slaLevel: 'standard' });
    expect(r.useSpot).toBe(false);
  });

  it('critical SLA → spot 거부', () => {
    const r = c.recommendSpot({ stateful: false, restartable: true, slaLevel: 'critical' });
    expect(r.useSpot).toBe(false);
  });

  it('stateless + restartable + standard → spot 추천', () => {
    const r = c.recommendSpot({ stateful: false, restartable: true, slaLevel: 'standard' });
    expect(r.useSpot).toBe(true);
  });
});
