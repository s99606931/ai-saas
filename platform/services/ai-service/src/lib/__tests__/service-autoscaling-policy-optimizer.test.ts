import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceAutoscalingPolicyOptimizer, type ScalingMetric } from '../service-autoscaling-policy-optimizer';

describe('ServiceAutoscalingPolicyOptimizer', () => {
  let optimizer: ServiceAutoscalingPolicyOptimizer;

  beforeEach(() => {
    optimizer = new ServiceAutoscalingPolicyOptimizer();
  });

  it('returns SCALE_OUT when cpuAvg>75', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S1', cpuAvg: 80, memAvg: 60, rpsAvg: 100, rpsP95: 150, sloTarget: 0.999 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.action).toBe('SCALE_OUT');
  });

  it('returns SCALE_OUT when rpsP95 > rpsAvg*2', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S2', cpuAvg: 50, memAvg: 50, rpsAvg: 100, rpsP95: 210, sloTarget: 0.999 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.action).toBe('SCALE_OUT');
  });

  it('returns SCALE_IN when cpuAvg<30 and memAvg<30', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S3', cpuAvg: 20, memAvg: 25, rpsAvg: 50, rpsP95: 60, sloTarget: 0.999 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.action).toBe('SCALE_IN');
  });

  it('returns MAINTAIN for normal metrics', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S4', cpuAvg: 50, memAvg: 50, rpsAvg: 100, rpsP95: 120, sloTarget: 0.999 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.action).toBe('MAINTAIN');
  });

  it('computes recommendedInstances with buffer', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S5', cpuAvg: 80, memAvg: 50, rpsAvg: 300, rpsP95: 350, sloTarget: 0.999 },
    ];
    const result = optimizer.optimize(metrics);
    // ceil(300/100) = 3, SCALE_OUT buffer +2 = 5
    expect(result[0]!.recommendedInstances).toBe(5);
  });

  it('marks HIGH_RISK for SCALE_IN with sloTarget<0.99', () => {
    const metrics: ScalingMetric[] = [
      { serviceId: 'S6', cpuAvg: 20, memAvg: 20, rpsAvg: 50, rpsP95: 60, sloTarget: 0.98 },
    ];
    const result = optimizer.optimize(metrics);
    expect(result[0]!.sloRisk).toBe('HIGH_RISK');
  });

  it('records audit log', () => {
    optimizer.optimize([
      { serviceId: 'S7', cpuAvg: 50, memAvg: 50, rpsAvg: 100, rpsP95: 120, sloTarget: 0.999 },
    ]);
    const log = optimizer.getAuditLog();
    expect(log[0]!.action).toBe('autoscaling.optimize');
  });
});
