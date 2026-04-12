import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceCostAnomalyDetectorV2 } from '../service-cost-anomaly-detector-v2';

describe('ServiceCostAnomalyDetectorV2', () => {
  let detector: ServiceCostAnomalyDetectorV2;

  beforeEach(() => {
    detector = new ServiceCostAnomalyDetectorV2();
  });

  it('서비스를 등록한다', () => {
    detector.registerService('svc-a', 'Service A', 1000, 100);
    const logs = detector.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_SERVICE')).toBe(true);
  });

  it('비용을 기록한다', () => {
    detector.registerService('svc-a', 'A', 1000, 100);
    detector.recordCost('svc-a', 100, '2026-04-01');
    const logs = detector.getAuditLog();
    expect(logs.some(l => l.action === 'RECORD_COST')).toBe(true);
  });

  it('예산 초과를 즉시 탐지한다', () => {
    detector.registerService('svc-a', 'A', 500, 100);
    detector.recordCost('svc-a', 600, '2026-04-01');
    const anomalies = detector.detectAnomalies('svc-a');
    expect(anomalies.some(a => a.type === 'budget_exceeded')).toBe(true);
    expect(anomalies.some(a => a.severity === 'critical')).toBe(true);
  });

  it('Z-스코어 > 2.0 이상을 탐지한다', () => {
    detector.registerService('svc-a', 'A', 9999, 100);
    for (let i = 0; i < 10; i++) {
      detector.recordCost('svc-a', 100, `2026-04-0${i + 1}`);
    }
    detector.recordCost('svc-a', 500, '2026-04-11');
    const anomalies = detector.detectAnomalies('svc-a');
    expect(anomalies.length).toBeGreaterThan(0);
  });

  it('이상 없으면 빈 배열을 반환한다', () => {
    detector.registerService('svc-a', 'A', 9999, 100);
    detector.recordCost('svc-a', 100, '2026-04-01');
    detector.recordCost('svc-a', 101, '2026-04-02');
    const anomalies = detector.detectAnomalies('svc-a');
    expect(anomalies.length).toBe(0);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    detector.registerService('svc-a', 'A', 1000, 100);
    expect(() => detector.recordCost('svc-a', 100, '2026-04-01', 'C' as never)).toThrow('BLOCKED');
  });

  it('잘못된 amount 값으로 예외를 던진다', () => {
    detector.registerService('svc-a', 'A', 1000, 100);
    expect(() => detector.recordCost('svc-a', -1, '2026-04-01')).toThrow('양수');
  });

  it('절감 권고를 반환한다', () => {
    detector.registerService('svc-a', 'A', 100, 50);
    detector.recordCost('svc-a', 200, '2026-04-01');
    detector.recordCost('svc-a', 200, '2026-04-02');
    detector.recordCost('svc-a', 200, '2026-04-03');
    const recs = detector.getRecommendations('svc-a');
    expect(recs.length).toBeGreaterThan(0);
  });

  it('미등록 서비스 이상 탐지 시 오류를 던진다', () => {
    expect(() => detector.detectAnomalies('unknown')).toThrow('서비스 미등록');
  });
});
