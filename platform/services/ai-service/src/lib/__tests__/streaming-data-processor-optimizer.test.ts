import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingDataProcessorOptimizer } from '../streaming-data-processor-optimizer';

describe('StreamingDataProcessorOptimizer', () => {
  let optimizer: StreamingDataProcessorOptimizer;

  beforeEach(() => {
    optimizer = new StreamingDataProcessorOptimizer();
  });

  it('파이프라인을 등록한다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 5000);
    expect(optimizer.getAuditLog().some(l => l.action === 'REGISTER_PIPELINE')).toBe(true);
  });

  it('메트릭을 기록한다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 5000);
    optimizer.recordMetrics('p1', 800, 1000);
    expect(optimizer.getAuditLog().some(l => l.action === 'RECORD_METRICS')).toBe(true);
  });

  it('백프레셔를 감지한다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 1000, 0.8);
    optimizer.recordMetrics('p1', 500, 900);
    const status = optimizer.detectBackpressure('p1');
    expect(status.hasBackpressure).toBe(true);
    expect(status.fillRatio).toBeGreaterThan(0.8);
  });

  it('정상 상태에서 백프레셔를 감지하지 않는다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 1000, 0.8);
    optimizer.recordMetrics('p1', 800, 100);
    const status = optimizer.detectBackpressure('p1');
    expect(status.hasBackpressure).toBe(false);
  });

  it('백프레셔 발생 시 최적화 권고를 반환한다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 1000, 0.8);
    optimizer.recordMetrics('p1', 500, 900);
    const recs = optimizer.getOptimizationRecommendations('p1');
    expect(recs.some(r => r.includes('파티션'))).toBe(true);
  });

  it('C등급 메트릭 기록을 차단한다', () => {
    optimizer.registerPipeline('p1', 'EventStream', 1000, 5000);
    expect(() => optimizer.recordMetrics('p1', 800, 100, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 파이프라인 메트릭 기록 시 오류를 던진다', () => {
    expect(() => optimizer.recordMetrics('unknown', 800, 100)).toThrow('파이프라인 미등록');
  });
});
