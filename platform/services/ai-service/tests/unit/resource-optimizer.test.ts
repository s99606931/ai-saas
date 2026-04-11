import { describe, it, expect } from 'vitest';
import { analyzeResourceUsage, recommendSizing, simulateCostSaving, suggestScalingPolicy, detectResourceAnomalies, getResourceAuditLog, type ResourceUsage } from '../../src/lib/resource-optimizer';

function generateUsageData(serviceName: string, count: number, base: number, noise: number = 0.1): ResourceUsage[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (count - i) * 3600000).toISOString(),
    resourceType: 'cpu' as const,
    serviceName,
    requested: base * 2,
    actual: base + (Math.random() - 0.5) * base * noise,
    limit: base * 3,
    unit: 'cores',
  }));
}

describe('리소스 최적화', () => {
  const USAGE = generateUsageData('api-gateway', 100, 4, 0.2);

  it('리소스 사용량을 분석해야 한다', () => {
    const stats = analyzeResourceUsage(USAGE, 'api-gateway');
    expect(stats.avg).toBeGreaterThan(0);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50);
    expect(stats.max).toBeGreaterThanOrEqual(stats.p95);
    expect(stats.utilizationRate).toBeGreaterThan(0);
  });

  it('적정 사이징을 추천해야 한다', () => {
    const rec = recommendSizing(USAGE, 'api-gateway', 'cpu', 'admin');
    expect(rec.recommendedRequest).toBeGreaterThan(0);
    expect(rec.recommendedLimit).toBeGreaterThanOrEqual(rec.recommendedRequest);
    expect(rec.reason).toBeDefined();
  });

  it('비용 절감을 시뮬레이션해야 한다', () => {
    const rec = recommendSizing(USAGE, 'api-gateway', 'cpu', 'admin');
    const sim = simulateCostSaving([rec], 'admin');
    expect(sim.currentMonthlyCost).toBeGreaterThan(0);
    expect(sim.savingAmount).toBeGreaterThanOrEqual(0);
  });

  it('스케일링 정책을 제안해야 한다', () => {
    const policy = suggestScalingPolicy(USAGE, 'api-gateway');
    expect(policy.minReplicas).toBeGreaterThanOrEqual(1);
    expect(policy.maxReplicas).toBeGreaterThanOrEqual(policy.minReplicas);
    expect(policy.targetCPUUtilization).toBeGreaterThan(0);
  });

  it('리소스 이상을 감지해야 한다', () => {
    const data = [...USAGE];
    data[data.length - 1] = { ...data[data.length - 1], actual: 100 }; // 극단값
    const anomalies = detectResourceAnomalies(data, 'api-gateway', 'admin');
    expect(anomalies.length).toBeGreaterThan(0);
  });

  it('정상 범위에서 이상을 감지하지 않아야 한다', () => {
    const normal = generateUsageData('normal-svc', 50, 2, 0.05);
    const anomalies = detectResourceAnomalies(normal, 'normal-svc', 'admin');
    expect(anomalies.length).toBeLessThanOrEqual(1);
  });

  it('감사 로그가 기록되어야 한다', () => {
    expect(getResourceAuditLog().length).toBeGreaterThan(0);
  });
});
