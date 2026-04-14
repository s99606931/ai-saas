import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceMeshTelemetryAiV2 } from '../service-mesh-telemetry-ai-v2';

describe('SVC-AI-ADV-R639 ServiceMeshTelemetryAiV2', () => {
  let svc: ServiceMeshTelemetryAiV2;

  beforeEach(() => {
    svc = new ServiceMeshTelemetryAiV2();
  });

  it('FR-R639.1: 서비스 등록', () => {
    svc.registerService('svc-a', 'gold');
    expect(svc.getAverageMetrics('svc-a')).toBeNull();
  });

  it('FR-R639.2: S등급 차단', () => {
    svc.registerService('svc-a', 'gold');
    expect(() => svc.recordMetric('svc-a', 100, 0.01, 'S')).toThrow(/BLOCKED/);
  });

  it('FR-R639.3: 평균 지표 산출', () => {
    svc.registerService('svc-a', 'gold');
    svc.recordMetric('svc-a', 100, 0.01);
    svc.recordMetric('svc-a', 300, 0.03);
    const avg = svc.getAverageMetrics('svc-a');
    expect(avg?.latencyMs).toBe(200);
    expect(avg?.errorRate).toBeCloseTo(0.02, 5);
  });

  it('FR-R639.4: SLA 위반 서비스 탐지', () => {
    svc.registerService('svc-a', 'gold');
    svc.registerService('svc-b', 'silver');
    svc.recordMetric('svc-a', 800, 0.01);
    svc.recordMetric('svc-b', 100, 0.01);
    const violations = svc.getSlaViolations();
    expect(violations.map((s) => s.serviceId)).toEqual(['svc-a']);
  });

  it('FR-R639.5: 감사 로그 누적', () => {
    svc.registerService('svc-a', 'gold');
    svc.recordMetric('svc-a', 100, 0.01);
    const log = svc.getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
  });
});
