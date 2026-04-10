// LRU 응답 캐시 테스트
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.1, FR-GW.2, FR-GW.6
// CSAP: D-10 접근 제어

import { describe, it, expect, afterEach } from 'vitest';
import { ResponseCache, buildCacheKey } from '../src/response-cache.js';

describe('ResponseCache', () => {
  let cache: ResponseCache<string>;

  afterEach(() => {
    if (cache) cache.destroy();
  });

  describe('FR-GW.1: LRU 응답 캐시', () => {
    it('값을 저장하고 조회할 수 있다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key-1', 'value-1', 0, 1000);
      expect(cache.get('key-1', 1000)).toBe('value-1');
    });

    it('존재하지 않는 키는 undefined', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      expect(cache.get('nonexistent', 1000)).toBeUndefined();
    });

    it('TTL 만료 후 undefined를 반환한다', () => {
      cache = new ResponseCache({ defaultTtlMs: 5000, cleanupIntervalMs: 0 });
      cache.set('key-1', 'value-1', 0, 1000);

      // TTL 내: 히트
      expect(cache.get('key-1', 4000)).toBe('value-1');
      // TTL 만료: 미스
      expect(cache.get('key-1', 7000)).toBeUndefined();
    });

    it('커스텀 TTL이 기본값을 오버라이드한다', () => {
      cache = new ResponseCache({ defaultTtlMs: 60000, cleanupIntervalMs: 0 });
      cache.set('short', 'value', 1000, 1000); // TTL 1초

      expect(cache.get('short', 1500)).toBe('value');
      expect(cache.get('short', 3000)).toBeUndefined();
    });

    it('LRU 퇴출: 가장 오래 접근되지 않은 항목이 제거된다', () => {
      cache = new ResponseCache({ maxSize: 3, cleanupIntervalMs: 0 });
      cache.set('a', 'v-a', 0, 1000);
      cache.set('b', 'v-b', 0, 1000);
      cache.set('c', 'v-c', 0, 1000);

      // 'a'를 조회하여 최근 사용으로 갱신
      cache.get('a', 2000);

      // 새 항목 추가 → 가장 오래된 'b'가 퇴출
      cache.set('d', 'v-d', 0, 2000);

      expect(cache.get('a', 2000)).toBe('v-a');
      expect(cache.get('b', 2000)).toBeUndefined(); // 퇴출됨
      expect(cache.get('c', 2000)).toBe('v-c');
      expect(cache.get('d', 2000)).toBe('v-d');
    });

    it('동일 키 업데이트 시 LRU 순서가 갱신된다', () => {
      cache = new ResponseCache({ maxSize: 2, cleanupIntervalMs: 0 });
      cache.set('a', 'v1', 0, 1000);
      cache.set('b', 'v2', 0, 1000);
      cache.set('a', 'v3', 0, 1000); // 'a' 갱신 → 최근으로 이동

      cache.set('c', 'v4', 0, 1000); // 'b'가 퇴출

      expect(cache.get('a', 1000)).toBe('v3');
      expect(cache.get('b', 1000)).toBeUndefined();
    });
  });

  describe('FR-GW.2: 캐시 키 전략', () => {
    it('buildCacheKey로 URL 기반 키 생성', () => {
      expect(buildCacheKey('GET', '/api/users')).toBe('GET:/api/users');
      expect(buildCacheKey('post', '/api/data')).toBe('POST:/api/data');
    });

    it('buildCacheKey로 테넌트 분리 키 생성', () => {
      expect(buildCacheKey('GET', '/api/users', 'tenant-1')).toBe('tenant-1:GET:/api/users');
      expect(buildCacheKey('GET', '/api/users', 'tenant-2')).toBe('tenant-2:GET:/api/users');
    });

    it('테넌트별 캐시가 분리된다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      const key1 = buildCacheKey('GET', '/api/data', 'tenant-1');
      const key2 = buildCacheKey('GET', '/api/data', 'tenant-2');

      cache.set(key1, 'data-1', 0, 1000);
      cache.set(key2, 'data-2', 0, 1000);

      expect(cache.get(key1, 1000)).toBe('data-1');
      expect(cache.get(key2, 1000)).toBe('data-2');
    });
  });

  describe('FR-GW.6: 캐시 무효화', () => {
    it('특정 키를 무효화할 수 있다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key-1', 'value', 0, 1000);
      expect(cache.invalidate('key-1')).toBe(true);
      expect(cache.get('key-1', 1000)).toBeUndefined();
    });

    it('접두사 패턴으로 무효화할 수 있다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('tenant-1:GET:/a', 'v1', 0, 1000);
      cache.set('tenant-1:GET:/b', 'v2', 0, 1000);
      cache.set('tenant-2:GET:/a', 'v3', 0, 1000);

      const count = cache.invalidateByPrefix('tenant-1:');
      expect(count).toBe(2);
      expect(cache.get('tenant-1:GET:/a', 1000)).toBeUndefined();
      expect(cache.get('tenant-2:GET:/a', 1000)).toBe('v3');
    });

    it('clear()로 전체 캐시를 비운다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('a', 'v1', 0, 1000);
      cache.set('b', 'v2', 0, 1000);

      cache.clear();
      expect(cache.getSize()).toBe(0);
    });
  });

  describe('통계', () => {
    it('히트/미스/적중률을 추적한다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key-1', 'value', 0, 1000);

      cache.get('key-1', 1000); // 히트
      cache.get('key-1', 1000); // 히트
      cache.get('key-2', 1000); // 미스

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('퇴출 수를 추적한다', () => {
      cache = new ResponseCache({ maxSize: 2, cleanupIntervalMs: 0 });
      cache.set('a', 'v1', 0, 1000);
      cache.set('b', 'v2', 0, 1000);
      cache.set('c', 'v3', 0, 1000); // 'a' 퇴출

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it('resetStats로 통계를 초기화한다', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key', 'value', 0, 1000);
      cache.get('key', 1000);

      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.hits).toBe(0);
    });
  });

  describe('has', () => {
    it('존재하고 만료되지 않은 키에 true', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key', 'value', 5000, 1000);
      expect(cache.has('key', 3000)).toBe(true);
    });

    it('만료된 키에 false', () => {
      cache = new ResponseCache({ cleanupIntervalMs: 0 });
      cache.set('key', 'value', 1000, 1000);
      expect(cache.has('key', 3000)).toBe(false);
    });
  });
});
