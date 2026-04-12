import { describe, it, expect, beforeEach } from 'vitest';
import { EventDrivenOptimizer, type TopicStats } from '../event-driven-optimizer';

describe('EventDrivenOptimizer', () => {
  let svc: EventDrivenOptimizer;

  beforeEach(() => {
    svc = new EventDrivenOptimizer();
    svc.registerSchema({ topic: 'orders', version: '1', fields: [{ name: 'id', type: 'string' }] });
  });

  it('FR-ED.1 스키마 레지스트리', () => {
    expect(svc.getSchema('orders', '1')?.topic).toBe('orders');
  });

  it('FR-ED.2 병합 추천', () => {
    const stats: TopicStats[] = [
      { topic: 't1', rps: 2, consumerLag: 0, partitions: 1 },
      { topic: 't2', rps: 3, consumerLag: 0, partitions: 1 },
    ];
    const recs = svc.recommendMerge(stats);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('FR-ED.3 파티션 조정', () => {
    const plan = svc.recommendPartitions({ topic: 't', rps: 8000, consumerLag: 0, partitions: 4 });
    expect(plan.recommendedPartitions).toBeGreaterThan(4);
  });

  it('FR-ED.4 랙 예측', () => {
    const fc = svc.forecastLag([100, 200, 300], 3);
    expect(fc.length).toBe(3);
    expect(fc[2]).toBeGreaterThan(300);
  });

  it('FR-ED.5 DLQ', () => {
    const r = svc.buildDlqRoute('orders');
    expect(r.dlqTopic).toBe('orders.dlq');
  });
});
