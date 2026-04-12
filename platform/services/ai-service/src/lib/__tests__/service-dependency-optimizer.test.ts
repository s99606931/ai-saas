import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceDependencyOptimizer, type ServiceNode } from '../service-dependency-optimizer';

describe('ServiceDependencyOptimizer', () => {
  let optimizer: ServiceDependencyOptimizer;

  const makeService = (id: string, deps: string[], latencyMs?: number): ServiceNode => ({
    id, name: id, version: '1.0.0', dependencies: deps, latencyMs,
  });

  beforeEach(() => {
    optimizer = new ServiceDependencyOptimizer();
  });

  // FR-R175.1 서비스 등록
  it('FR-R175.1 서비스 등록', () => {
    optimizer.registerService(makeService('svc-a', []));
    const recs = optimizer.generateRecommendations();
    expect(Array.isArray(recs)).toBe(true);
  });

  // FR-R175.2 순환 의존성 탐지
  it('FR-R175.2 순환 의존성 탐지', () => {
    optimizer.registerService(makeService('a', ['b']));
    optimizer.registerService(makeService('b', ['c']));
    optimizer.registerService(makeService('c', ['a'])); // cycle: a->b->c->a
    const cycles = optimizer.detectCircular();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('FR-R175.2 순환 없음', () => {
    optimizer.registerService(makeService('a', ['b']));
    optimizer.registerService(makeService('b', ['c']));
    optimizer.registerService(makeService('c', []));
    const cycles = optimizer.detectCircular();
    expect(cycles.length).toBe(0);
  });

  // FR-R175.3 깊은 체인 탐지
  it('FR-R175.3 깊은 체인 탐지 (4단계)', () => {
    optimizer.registerService(makeService('a', ['b']));
    optimizer.registerService(makeService('b', ['c']));
    optimizer.registerService(makeService('c', ['d']));
    optimizer.registerService(makeService('d', ['e']));
    optimizer.registerService(makeService('e', []));
    const deep = optimizer.detectDeepChains(3);
    expect(deep.some((d) => d.service === 'a')).toBe(true);
  });

  it('FR-R175.3 얕은 체인 탐지 안됨', () => {
    optimizer.registerService(makeService('a', ['b']));
    optimizer.registerService(makeService('b', []));
    expect(optimizer.detectDeepChains(3)).toHaveLength(0);
  });

  // FR-R175.4 최적화 권고
  it('FR-R175.4 순환 의존성 → HIGH 권고', () => {
    optimizer.registerService(makeService('x', ['y']));
    optimizer.registerService(makeService('y', ['x']));
    const recs = optimizer.generateRecommendations();
    expect(recs.some((r) => r.issue.type === 'CIRCULAR' && r.issue.severity === 'HIGH')).toBe(true);
  });

  it('FR-R175.4 고지연 서비스 → 권고 생성', () => {
    optimizer.registerService(makeService('slow-svc', [], 800));
    const recs = optimizer.generateRecommendations();
    expect(recs.some((r) => r.issue.type === 'HIGH_LATENCY')).toBe(true);
  });

  it('FR-R175.4 정상 서비스 → 권고 없음', () => {
    optimizer.registerService(makeService('ok-svc', [], 100));
    const recs = optimizer.generateRecommendations();
    expect(recs.some((r) => r.issue.type === 'HIGH_LATENCY')).toBe(false);
  });

  // FR-R175.5 감사 로그
  it('FR-R175.5 감사 로그 기록', () => {
    optimizer.generateRecommendations();
    const log = optimizer.getAuditLog();
    expect(log.some((e) => e.action === 'RECOMMENDATIONS_GENERATED')).toBe(true);
  });
});
