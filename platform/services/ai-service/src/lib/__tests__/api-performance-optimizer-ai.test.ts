import { describe, it, expect, beforeEach } from 'vitest';
import { ApiPerformanceOptimizerAI } from '../api-performance-optimizer-ai';

describe('ApiPerformanceOptimizerAI', () => {
  let optimizer: ApiPerformanceOptimizerAI;

  beforeEach(() => {
    optimizer = new ApiPerformanceOptimizerAI();
  });

  it('엔드포인트를 등록한다', () => {
    optimizer.registerEndpoint('/api/users', 'GET', 200);
    const logs = optimizer.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_ENDPOINT')).toBe(true);
  });

  it('통계를 계산한다 (avg/p95/p99)', () => {
    optimizer.registerEndpoint('/api/users', 'GET', 300);
    for (let i = 1; i <= 10; i++) {
      optimizer.recordCall('/api/users', 'GET', i * 10);
    }
    const stats = optimizer.getStats('/api/users', 'GET');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(10);
    expect(stats!.avgMs).toBe(55);
    expect(stats!.p95Ms).toBe(100);
  });

  it('SLA 위반을 탐지한다', () => {
    optimizer.registerEndpoint('/api/slow', 'POST', 100);
    for (let i = 0; i < 20; i++) {
      optimizer.recordCall('/api/slow', 'POST', 200);
    }
    const violations = optimizer.detectSlaViolations();
    expect(violations.length).toBe(1);
    expect(violations[0]!.path).toBe('/api/slow');
    expect(violations[0]!.p95Ms).toBeGreaterThan(100);
  });

  it('SLA 위반 없을 때 빈 배열을 반환한다', () => {
    optimizer.registerEndpoint('/api/fast', 'GET', 500);
    optimizer.recordCall('/api/fast', 'GET', 50);
    const violations = optimizer.detectSlaViolations();
    expect(violations.length).toBe(0);
  });

  it('최적화 권고를 생성한다 (캐싱)', () => {
    optimizer.registerEndpoint('/api/heavy', 'GET', 100);
    for (let i = 0; i < 10; i++) {
      optimizer.recordCall('/api/heavy', 'GET', 90);
    }
    const recs = optimizer.getOptimizationRecommendations();
    expect(recs.some(r => r.type === 'caching')).toBe(true);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    optimizer.registerEndpoint('/api/test', 'GET', 200);
    expect(() => optimizer.recordCall('/api/test', 'GET', 100, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 엔드포인트 통계는 null을 반환한다', () => {
    const stats = optimizer.getStats('/unknown', 'GET');
    expect(stats).toBeNull();
  });

  it('기록 없는 엔드포인트 통계는 count=0이다', () => {
    optimizer.registerEndpoint('/api/empty', 'DELETE', 200);
    const stats = optimizer.getStats('/api/empty', 'DELETE');
    expect(stats!.count).toBe(0);
  });
});
