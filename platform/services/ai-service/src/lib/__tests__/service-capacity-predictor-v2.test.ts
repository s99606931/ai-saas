import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceCapacityPredictorV2, type CapacityMetric } from '../service-capacity-predictor-v2';

describe('ServiceCapacityPredictorV2', () => {
  let predictor: ServiceCapacityPredictorV2;

  beforeEach(() => {
    predictor = new ServiceCapacityPredictorV2();
  });

  it('classifies OVERLOADED when cpu>80', () => {
    const metrics: CapacityMetric[] = [
      { serviceId: 'S1', cpuUsage: 90, memUsage: 50, requestRate: 100, window: 'day', growthRate: 0.1 },
    ];
    const result = predictor.predict(metrics);
    expect(result[0]!.status).toBe('OVERLOADED');
  });

  it('classifies WARNING when cpu>60 and mem<=80', () => {
    const metrics: CapacityMetric[] = [
      { serviceId: 'S2', cpuUsage: 70, memUsage: 55, requestRate: 100, window: 'week', growthRate: 0.05 },
    ];
    const result = predictor.predict(metrics);
    expect(result[0]!.status).toBe('WARNING');
  });

  it('classifies HEALTHY when both cpu and mem <=60', () => {
    const metrics: CapacityMetric[] = [
      { serviceId: 'S3', cpuUsage: 40, memUsage: 50, requestRate: 200, window: 'month', growthRate: 0.2 },
    ];
    const result = predictor.predict(metrics);
    expect(result[0]!.status).toBe('HEALTHY');
  });

  it('computes recommendedCapacity = round(requestRate*(1+growthRate*1.2))', () => {
    const metrics: CapacityMetric[] = [
      { serviceId: 'S4', cpuUsage: 40, memUsage: 40, requestRate: 100, window: 'day', growthRate: 0.1 },
    ];
    const result = predictor.predict(metrics);
    // 100 * (1 + 0.1 * 1.2) = 100 * 1.12 = 112
    expect(result[0]!.recommendedCapacity).toBe(112);
  });

  it('OVERLOADED when mem>80', () => {
    const metrics: CapacityMetric[] = [
      { serviceId: 'S5', cpuUsage: 50, memUsage: 85, requestRate: 50, window: 'day', growthRate: 0.0 },
    ];
    const result = predictor.predict(metrics);
    expect(result[0]!.status).toBe('OVERLOADED');
  });

  it('records audit log', () => {
    predictor.predict([
      { serviceId: 'S6', cpuUsage: 30, memUsage: 30, requestRate: 50, window: 'day', growthRate: 0.05 },
    ]);
    const log = predictor.getAuditLog();
    expect(log[0]!.action).toBe('capacity.predict');
  });
});
