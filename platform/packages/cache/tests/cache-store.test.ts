// @public-saas/cache 캐시 스토어 테스트
// Design Ref: SVC-CACHE-R7 Plan
// Plan SC: FR-CACHE.1, FR-CACHE.2, FR-CACHE.3
// CSAP: D-07 가용성, D-08-05 테넌트 격리

import { describe, it, expect, beforeEach } from 'vitest';
import { CacheStore } from '../src/cache-store.js';

describe('CacheStore -- 기본 CRUD', () => {
  let cache: CacheStore;

  beforeEach(() => {
    cache = new CacheStore({ prefix: 'test', defaultTtlSeconds: 60, maxEntries: 100 });
  });

  it('키 빌드 -- 테넌트 격리 패턴', () => {
    const key = cache.buildKey('tenant', 't-001', 'list', 'page=1');
    expect(key).toBe('test:tenant:t-001:list:page=1');
  });

  it('키 빌드 -- 식별자 없는 경우', () => {
    const key = cache.buildKey('menu', 't-002', 'tree');
    expect(key).toBe('test:menu:t-002:tree');
  });

  it('set + get 기본 동작', () => {
    const key = cache.buildKey('svc', 't-1', 'data');
    cache.set(key, { name: '테스트' }, 't-1');
    const result = cache.get<{ name: string }>(key);
    expect(result).toEqual({ name: '테스트' });
  });

  it('존재하지 않는 키 조회 시 undefined', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('delete -- 단일 키 삭제', () => {
    const key = cache.buildKey('svc', 't-1', 'data');
    cache.set(key, 'value', 't-1');
    expect(cache.delete(key)).toBe(true);
    expect(cache.get(key)).toBeUndefined();
  });

  it('clear -- 전체 초기화', () => {
    cache.set('k1', 'v1', 't-1');
    cache.set('k2', 'v2', 't-2');
    cache.clear();
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')).toBeUndefined();
    expect(cache.getStats().entries).toBe(0);
  });
});

describe('CacheStore -- TTL 만료', () => {
  it('TTL 만료 후 조회 시 undefined', async () => {
    const cache = new CacheStore({ prefix: 'test', defaultTtlSeconds: 1 });
    const key = cache.buildKey('svc', 't-1', 'data');
    cache.set(key, 'short-lived', 't-1', 1); // 1초 TTL

    // 즉시 조회 -- 존재
    expect(cache.get(key)).toBe('short-lived');

    // 1.1초 대기 후 만료
    await new Promise((r) => setTimeout(r, 1100));
    expect(cache.get(key)).toBeUndefined();
  });

  it('cleanup -- 만료 항목 수동 정리', async () => {
    const cache = new CacheStore({ prefix: 'test' });
    cache.set('k1', 'v1', 't-1', 1); // 1초 TTL
    cache.set('k2', 'v2', 't-1', 3600); // 1시간 TTL

    await new Promise((r) => setTimeout(r, 1100));
    const cleaned = cache.cleanup();
    expect(cleaned).toBe(1);
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')).toBe('v2');
  });
});

describe('CacheStore -- 테넌트 격리 (CSAP D-08-05)', () => {
  let cache: CacheStore;

  beforeEach(() => {
    cache = new CacheStore({ prefix: 'saas' });
  });

  it('같은 리소스라도 테넌트별 독립 캐시', () => {
    const key1 = cache.buildKey('user', 't-A', 'profile', 'user-1');
    const key2 = cache.buildKey('user', 't-B', 'profile', 'user-1');

    cache.set(key1, { name: '테넌트A 사용자' }, 't-A');
    cache.set(key2, { name: '테넌트B 사용자' }, 't-B');

    expect(cache.get<{ name: string }>(key1)?.name).toBe('테넌트A 사용자');
    expect(cache.get<{ name: string }>(key2)?.name).toBe('테넌트B 사용자');
    expect(key1).not.toBe(key2);
  });

  it('invalidateTenant -- 특정 테넌트 캐시만 삭제', () => {
    cache.set('key-a1', 'a1', 't-A');
    cache.set('key-a2', 'a2', 't-A');
    cache.set('key-b1', 'b1', 't-B');

    const deleted = cache.invalidateTenant('t-A');
    expect(deleted).toBe(2);
    expect(cache.get('key-a1')).toBeUndefined();
    expect(cache.get('key-a2')).toBeUndefined();
    expect(cache.get('key-b1')).toBe('b1'); // 다른 테넌트는 유지
  });

  it('deleteByPattern -- 패턴 기반 삭제', () => {
    const k1 = cache.buildKey('catalog', 't-1', 'services', 'page=1');
    const k2 = cache.buildKey('catalog', 't-1', 'services', 'page=2');
    const k3 = cache.buildKey('catalog', 't-1', 'stats');
    const k4 = cache.buildKey('catalog', 't-2', 'services', 'page=1');

    cache.set(k1, 'v1', 't-1');
    cache.set(k2, 'v2', 't-1');
    cache.set(k3, 'v3', 't-1');
    cache.set(k4, 'v4', 't-2');

    // t-1의 서비스 캐시만 삭제
    const deleted = cache.deleteByPattern('saas:catalog:t-1:services:*');
    expect(deleted).toBe(2);
    expect(cache.get(k1)).toBeUndefined();
    expect(cache.get(k2)).toBeUndefined();
    expect(cache.get(k3)).toBe('v3'); // stats는 유지
    expect(cache.get(k4)).toBe('v4'); // 다른 테넌트는 유지
  });
});

describe('CacheStore -- getOrFetch (Read-through)', () => {
  it('캐시 미스 시 fetcher 실행 후 캐싱', async () => {
    const cache = new CacheStore({ prefix: 'test' });
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount++;
      return { data: '서버에서 조회' };
    };

    const key = cache.buildKey('svc', 't-1', 'item');

    // 첫 호출: fetcher 실행
    const result1 = await cache.getOrFetch(key, 't-1', fetcher);
    expect(result1).toEqual({ data: '서버에서 조회' });
    expect(fetchCount).toBe(1);

    // 두 번째 호출: 캐시 히트
    const result2 = await cache.getOrFetch(key, 't-1', fetcher);
    expect(result2).toEqual({ data: '서버에서 조회' });
    expect(fetchCount).toBe(1); // fetcher 재실행 안 됨
  });
});

describe('CacheStore -- 통계 + 최대 용량 관리', () => {
  it('히트/미스 통계 추적', () => {
    const cache = new CacheStore({ prefix: 'test' });
    cache.set('k1', 'v1', 't-1');

    cache.get('k1'); // 히트
    cache.get('k1'); // 히트
    cache.get('k2'); // 미스

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    expect(stats.entries).toBe(1);
  });

  it('maxEntries 초과 시 가장 오래된 항목 제거', () => {
    const cache = new CacheStore({ prefix: 'test', maxEntries: 3 });

    cache.set('k1', 'v1', 't-1');
    cache.set('k2', 'v2', 't-1');
    cache.set('k3', 'v3', 't-1');
    cache.set('k4', 'v4', 't-1'); // k1 제거됨

    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k4')).toBe('v4');
    expect(cache.getStats().evictions).toBe(1);
  });
});
