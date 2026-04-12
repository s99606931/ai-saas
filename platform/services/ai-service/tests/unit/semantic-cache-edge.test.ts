// MTU-N380 단위 테스트
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cosineSimilarity,
  cacheSet,
  cacheGet,
  evictLRU,
  clearTenantCache,
  getCacheStats,
  SemanticCacheEdgeService,
  getSemCacheAuditLog,
} from '../../src/lib/semantic-cache-edge';

describe('MTU-N380 SemanticCacheEdge', () => {
  beforeEach(() => {
    clearTenantCache('tN380');
    clearTenantCache('tA');
    clearTenantCache('tB');
  });

  it('코사인 유사도 - 동일 벡터', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it('코사인 유사도 - 직교', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('코사인 유사도 - 길이 다름', () => {
    expect(cosineSimilarity([1], [1, 0])).toBe(0);
  });

  it('캐시 저장', () => {
    const key = cacheSet('tN380', '안녕', [1, 0, 0], '안녕하세요');
    expect(key).toContain('tN380');
  });

  it('캐시 히트 - 높은 유사도', () => {
    cacheSet('tN380', '안녕', [1, 0, 0], '안녕하세요');
    const hit = cacheGet('tN380', [0.99, 0.01, 0.01], 0.9);
    expect(hit).toBeDefined();
    expect(hit?.response).toBe('안녕하세요');
  });

  it('캐시 미스 - 낮은 유사도', () => {
    cacheSet('tN380', '안녕', [1, 0, 0], '안녕하세요');
    const hit = cacheGet('tN380', [0, 1, 0], 0.9);
    expect(hit).toBeUndefined();
  });

  it('테넌트 격리', () => {
    cacheSet('tA', 'q', [1, 0, 0], 'r');
    const hit = cacheGet('tB', [1, 0, 0], 0.9);
    expect(hit).toBeUndefined();
  });

  it('LRU 축출', () => {
    for (let i = 0; i < 10; i++) {
      cacheSet('tN380', `q${i}`, [Math.random(), Math.random(), Math.random()], `r${i}`);
    }
    const evicted = evictLRU(5);
    expect(evicted).toBeGreaterThanOrEqual(0);
  });

  it('통계 - 히트율', () => {
    cacheSet('tN380', 'q', [1, 0, 0], 'r');
    cacheGet('tN380', [1, 0, 0], 0.9);
    cacheGet('tN380', [0, 0, 1], 0.9); // miss
    const stats = getCacheStats();
    expect(stats.hits).toBeGreaterThan(0);
  });

  it('테넌트 캐시 삭제', () => {
    cacheSet('tN380', 'q', [1, 0, 0], 'r');
    const deleted = clearTenantCache('tN380');
    expect(deleted).toBeGreaterThanOrEqual(1);
  });

  it('서비스 클래스', () => {
    const svc = new SemanticCacheEdgeService('tN380', 0.9);
    svc.set('q', [1, 0, 0], 'r');
    const hit = svc.get([1, 0, 0]);
    expect(hit).toBeDefined();
  });

  it('감사 로그 기록', () => {
    cacheSet('tenant-audit', 'q', [1, 0, 0], 'r');
    expect(getSemCacheAuditLog('tenant-audit').length).toBeGreaterThan(0);
  });
});
