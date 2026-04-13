import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceSatisfactionPredictor } from '../service-satisfaction-predictor';

describe('ServiceSatisfactionPredictor', () => {
  let predictor: ServiceSatisfactionPredictor;

  beforeEach(() => {
    predictor = new ServiceSatisfactionPredictor();
  });

  it('서비스를 등록한다', () => {
    predictor.registerService('svc-a', 'Service A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    expect(predictor.getAuditLog().some(l => l.action === 'REGISTER_SERVICE')).toBe(true);
  });

  it('지표를 기록한다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    predictor.recordMetrics('svc-a', 200, 0.5, 99.9);
    expect(predictor.getAuditLog().some(l => l.action === 'RECORD_METRICS')).toBe(true);
  });

  it('좋은 지표에서 높은 만족도 점수를 반환한다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    predictor.recordMetrics('svc-a', 100, 0.1, 99.9);
    const score = predictor.calculateScore('svc-a');
    expect(score.score).toBeGreaterThan(80);
    expect(score.status).toBe('above_target');
  });

  it('나쁜 지표에서 낮은 만족도 점수를 반환한다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    predictor.recordMetrics('svc-a', 2000, 10, 90);
    const score = predictor.calculateScore('svc-a');
    expect(score.status).toBe('below_target');
  });

  it('지표 없으면 score=0이다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    const score = predictor.calculateScore('svc-a');
    expect(score.score).toBe(0);
  });

  it('개선 트렌드를 탐지한다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    predictor.recordMetrics('svc-a', 500, 2, 95);
    predictor.recordMetrics('svc-a', 300, 1, 98);
    predictor.recordMetrics('svc-a', 100, 0.1, 99.9);
    const trend = predictor.predictTrend('svc-a');
    expect(['improving', 'stable']).toContain(trend.trend);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    expect(() => predictor.recordMetrics('svc-a', 200, 1, 99, 'C' as never)).toThrow('BLOCKED');
  });

  it('권고사항이 생성된다 (오류율 높을 때)', () => {
    predictor.registerService('svc-a', 'A', 80, { responseTime: 1, errorRate: 1, availability: 1 });
    predictor.recordMetrics('svc-a', 200, 5, 99);
    predictor.recordMetrics('svc-a', 200, 5, 99);
    const trend = predictor.predictTrend('svc-a');
    expect(trend.recommendations.some(r => r.includes('오류율'))).toBe(true);
  });
});
