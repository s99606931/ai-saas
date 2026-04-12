/**
 * 오케스트레이션·이벤트·API GW·멀티리전 테스트
 */

import {
  ServiceTopology,
  EventTopicOptimizer,
  ApiTrafficShaper,
  MultiRegionSyncOptimizer,
} from '../src/index';

describe('ServiceTopology', () => {
  it('addService + recordCall + slowestPaths', () => {
    const t = new ServiceTopology();
    t.addService({ serviceId: 'a', name: 'A', endpoints: [] });
    t.addService({ serviceId: 'b', name: 'B', endpoints: [] });
    t.recordCall({ from: 'a', to: 'b', callCount: 100, avgLatencyMs: 50, errorRate: 0.01 });
    t.recordCall({ from: 'a', to: 'b', callCount: 100, avgLatencyMs: 100, errorRate: 0.01 });
    expect(t.nodeCount()).toBe(2);
    const slow = t.slowestPaths();
    expect(slow[0]?.callCount).toBe(200);
    expect(slow[0]?.avgLatencyMs).toBeCloseTo(75);
  });

  it('unreliablePaths: 임계 초과만 반환', () => {
    const t = new ServiceTopology();
    t.recordCall({ from: 'a', to: 'b', callCount: 100, avgLatencyMs: 10, errorRate: 0.1 });
    t.recordCall({ from: 'a', to: 'c', callCount: 100, avgLatencyMs: 10, errorRate: 0.01 });
    const r = t.unreliablePaths(0.05);
    expect(r.length).toBe(1);
    expect(r[0]?.to).toBe('b');
  });
});

describe('EventTopicOptimizer', () => {
  const o = new EventTopicOptimizer();

  it('파티션 추천: 10k/s 기준', () => {
    const r = o.recommendPartitions({
      topic: 't1',
      partitionCount: 1,
      messagesPerSec: 50000,
      avgMessageSizeBytes: 1024,
      consumerLag: 0,
    });
    expect(r).toBeGreaterThanOrEqual(5);
  });

  it('현재 파티션이 더 많으면 유지', () => {
    const r = o.recommendPartitions({
      topic: 't1',
      partitionCount: 100,
      messagesPerSec: 1000,
      avgMessageSizeBytes: 1024,
      consumerLag: 0,
    });
    expect(r).toBe(100);
  });

  it('predictLag: 단순 선형', () => {
    expect(o.predictLag([0, 10, 20], 2)).toBeGreaterThan(20);
  });

  it('predictLag: 1개 입력 시 그대로', () => {
    expect(o.predictLag([5], 10)).toBe(5);
  });

  it('recommendMerge: 유사 패턴 페어', () => {
    const pairs = o.recommendMerge([
      { topic: 'a', partitionCount: 1, messagesPerSec: 100, avgMessageSizeBytes: 1000, consumerLag: 0 },
      { topic: 'b', partitionCount: 1, messagesPerSec: 110, avgMessageSizeBytes: 1100, consumerLag: 0 },
      { topic: 'c', partitionCount: 1, messagesPerSec: 10000, avgMessageSizeBytes: 100000, consumerLag: 0 },
    ]);
    expect(pairs.find((p) => p.includes('a') && p.includes('b'))).toBeDefined();
  });
});

describe('ApiTrafficShaper', () => {
  const s = new ApiTrafficShaper();

  it('classify: GET → read', () => {
    expect(s.classify({ path: '/x', method: 'GET', userId: 'u', sizeBytes: 0 })).toBe('read');
  });

  it('classify: 큰 POST → expensive', () => {
    expect(
      s.classify({ path: '/x', method: 'POST', userId: 'u', sizeBytes: 200000 }),
    ).toBe('expensive');
  });

  it('classify: 작은 POST → write', () => {
    expect(s.classify({ path: '/x', method: 'POST', userId: 'u', sizeBytes: 100 })).toBe('write');
  });

  it('computeRateLimit: 부하 90%+ → 30%', () => {
    expect(s.computeRateLimit(95, 'standard')).toBe(30);
  });

  it('computeRateLimit: 정상 부하 → 기본', () => {
    expect(s.computeRateLimit(50, 'premium')).toBe(1000);
  });

  it('isAttack: path traversal', () => {
    expect(s.isAttack({ path: '/../etc/passwd', method: 'GET', userId: 'u', sizeBytes: 0 })).toBe(true);
  });

  it('isAttack: XSS', () => {
    expect(s.isAttack({ path: '/<script>', method: 'GET', userId: 'u', sizeBytes: 0 })).toBe(true);
  });

  it('isAttack: 정상 path → false', () => {
    expect(s.isAttack({ path: '/api/users', method: 'GET', userId: 'u', sizeBytes: 0 })).toBe(false);
  });
});

describe('MultiRegionSyncOptimizer', () => {
  const o = new MultiRegionSyncOptimizer();

  it('지연 200ms+ → 1000 배치', () => {
    o.addRegion({ regionId: 'r1', location: 'eu', latencyToPrimaryMs: 250 });
    expect(o.recommendBatchSize('r1')).toBe(1000);
  });

  it('지연 100~200 → 500', () => {
    o.addRegion({ regionId: 'r2', location: 'jp', latencyToPrimaryMs: 150 });
    expect(o.recommendBatchSize('r2')).toBe(500);
  });

  it('미존재 region → 기본 100', () => {
    expect(o.recommendBatchSize('nope')).toBe(100);
  });

  it('resolveConflict: LWW', () => {
    const a = { id: 1, updatedAt: '2026-04-10' };
    const b = { id: 1, updatedAt: '2026-04-12' };
    expect(o.resolveConflict(a, b)).toBe(b);
  });
});
