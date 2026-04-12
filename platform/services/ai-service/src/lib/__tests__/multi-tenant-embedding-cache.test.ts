import { describe, it, expect } from 'vitest';
import { MultiTenantEmbeddingCache } from '../multi-tenant-embedding-cache.js';

describe('MultiTenantEmbeddingCache.hashKey (FR-R54.1)', () => {
  it('동일 텍스트는 동일 해시', () => {
    const cache = new MultiTenantEmbeddingCache();
    expect(cache.hashKey('hello')).toBe(cache.hashKey('hello'));
  });
  it('다른 텍스트는 다른 해시', () => {
    const cache = new MultiTenantEmbeddingCache();
    expect(cache.hashKey('a')).not.toBe(cache.hashKey('b'));
  });
});

describe('MultiTenantEmbeddingCache private 계층 (FR-R54.2)', () => {
  it('set 후 get 가능', () => {
    const cache = new MultiTenantEmbeddingCache();
    const vec = [1, 2, 3];
    cache.setPrivate('t1', 'k1', vec);
    const got = cache.getPrivate('t1', 'k1');
    expect(got?.vector).toEqual(vec);
  });
  it('다른 테넌트는 격리됨', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.setPrivate('t1', 'k1', [1]);
    expect(cache.getPrivate('t2', 'k1')).toBeUndefined();
  });
});

describe('MultiTenantEmbeddingCache shared 계층 (FR-R54.3)', () => {
  it('O등급만 저장 가능', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.setShared('k1', [1, 2], 'O');
    expect(cache.getShared('k1')?.vector).toEqual([1, 2]);
  });
  it('C등급 차단', () => {
    const cache = new MultiTenantEmbeddingCache();
    expect(() => cache.setShared('k1', [1], 'C')).toThrow('CACHE_GRADE_BLOCKED');
  });
  it('S등급 차단', () => {
    const cache = new MultiTenantEmbeddingCache();
    expect(() => cache.setShared('k1', [1], 'S')).toThrow('CACHE_GRADE_BLOCKED');
  });
});

describe('MultiTenantEmbeddingCache.lookup (FR-R54.4)', () => {
  it('전용 hit', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.store('t1', 'text', [1, 2], 'O');
    const got = cache.lookup('t1', 'text', 'O');
    expect(got?.vector).toEqual([1, 2]);
    expect(cache.getStats().privateHits).toBe(1);
  });
  it('공유 hit 시 전용으로 승격', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.store('t1', 'text', [1, 2], 'O');
    // t2는 처음엔 전용에 없음. lookup → 공유 hit → 전용 승격
    const got = cache.lookup('t2', 'text', 'O');
    expect(got?.vector).toEqual([1, 2]);
    expect(cache.getStats().sharedHits).toBe(1);
    // 두 번째 lookup은 전용 hit
    cache.lookup('t2', 'text', 'O');
    expect(cache.getStats().privateHits).toBe(1);
  });
  it('C등급은 공유 계층 조회 불가', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.setShared('k1', [1], 'O');
    const key = cache.hashKey('text');
    cache.setShared(key, [1], 'O');
    const got = cache.lookup('t1', 'text', 'C');
    expect(got).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });
  it('완전 미스 기록', () => {
    const cache = new MultiTenantEmbeddingCache();
    const got = cache.lookup('t1', 'missing', 'O');
    expect(got).toBeUndefined();
    expect(cache.getStats().misses).toBe(1);
  });
});

describe('MultiTenantEmbeddingCache LRU (FR-R54.5)', () => {
  it('전용 maxSize 초과 시 오래된 항목 제거', () => {
    const cache = new MultiTenantEmbeddingCache({ maxPrivate: 2 });
    cache.setPrivate('t1', 'k1', [1]);
    cache.setPrivate('t1', 'k2', [2]);
    cache.setPrivate('t1', 'k3', [3]);
    expect(cache.getPrivate('t1', 'k1')).toBeUndefined();
    expect(cache.getPrivate('t1', 'k2')?.vector).toEqual([2]);
    expect(cache.getPrivate('t1', 'k3')?.vector).toEqual([3]);
  });
  it('공유 maxSize 초과 시 오래된 항목 제거', () => {
    const cache = new MultiTenantEmbeddingCache({ maxShared: 2 });
    cache.setShared('k1', [1], 'O');
    cache.setShared('k2', [2], 'O');
    cache.setShared('k3', [3], 'O');
    expect(cache.getShared('k1')).toBeUndefined();
  });
  it('재접근 시 LRU 갱신', () => {
    const cache = new MultiTenantEmbeddingCache({ maxPrivate: 2 });
    cache.setPrivate('t1', 'k1', [1]);
    cache.setPrivate('t1', 'k2', [2]);
    cache.getPrivate('t1', 'k1'); // k1을 최근 사용으로 갱신
    cache.setPrivate('t1', 'k3', [3]);
    expect(cache.getPrivate('t1', 'k1')?.vector).toEqual([1]);
    expect(cache.getPrivate('t1', 'k2')).toBeUndefined();
  });
});

describe('MultiTenantEmbeddingCache 통계/감사 (FR-R54.6)', () => {
  it('히트율 계산', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.store('t1', 'a', [1], 'O');
    cache.lookup('t1', 'a', 'O'); // hit
    cache.lookup('t1', 'b', 'O'); // miss
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0.5);
  });
  it('감사 로그에 주요 액션 기록', () => {
    const cache = new MultiTenantEmbeddingCache();
    cache.store('t1', 'a', [1], 'O');
    cache.lookup('t1', 'a', 'O');
    const log = cache.getAuditLog();
    expect(log.some((e) => e.action === 'SET_PRIVATE')).toBe(true);
    expect(log.some((e) => e.action === 'SET_SHARED')).toBe(true);
    expect(log.some((e) => e.action === 'HIT_PRIVATE')).toBe(true);
  });
  it('BLOCK_GRADE 감사 기록', () => {
    const cache = new MultiTenantEmbeddingCache();
    expect(() => cache.setShared('k', [1], 'C')).toThrow();
    expect(cache.getAuditLog().some((e) => e.action === 'BLOCK_GRADE')).toBe(true);
  });
});
