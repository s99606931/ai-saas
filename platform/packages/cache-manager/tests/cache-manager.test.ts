// Cache Manager 테스트
// Design Ref: SVC-CACHE-R30 DESIGN
// Plan SC: FR-CM.1~FR-CM.6

import { describe, it, expect } from 'vitest';
import { CacheManager } from '../src/cache-manager.js';

describe('CacheManager', () => {
  describe('FR-CM.1: 기본 캐시 연산', () => {
    it('get/set으로 값을 저장하고 조회한다', () => {
      const cache = new CacheManager<string>();

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('존재하지 않는 키는 undefined를 반환한다', () => {
      const cache = new CacheManager<string>();
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('delete로 항목을 삭제한다', () => {
      const cache = new CacheManager<string>();
      cache.set('key1', 'value1');

      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('has로 존재 여부를 확인한다', () => {
      const cache = new CacheManager<string>();
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('clear로 전체 캐시를 비운다', () => {
      const cache = new CacheManager<string>();
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      cache.clear();
      expect(cache.getSize()).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    it('같은 키에 set하면 값을 덮어쓴다', () => {
      const cache = new CacheManager<string>();
      cache.set('key1', 'old');
      cache.set('key1', 'new');

      expect(cache.get('key1')).toBe('new');
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('FR-CM.2: TTL 만료', () => {
    it('TTL 만료 후 값이 사라진다', async () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 100 });

      cache.set('short-lived', 'value');
      expect(cache.get('short-lived')).toBe('value');

      await new Promise((r) => setTimeout(r, 150));
      expect(cache.get('short-lived')).toBeUndefined();
    });

    it('항목별 TTL을 지정할 수 있다', async () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 10_000 });

      cache.set('custom-ttl', 'value', 100);

      await new Promise((r) => setTimeout(r, 250));
      expect(cache.get('custom-ttl')).toBeUndefined();
    });

    it('has()도 TTL 만료를 확인한다', async () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 100 });
      cache.set('key1', 'value');

      await new Promise((r) => setTimeout(r, 150));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('FR-CM.3: LRU 퇴거', () => {
    it('maxSize 초과 시 가장 오래된 항목을 제거한다', () => {
      const cache = new CacheManager<string>({ maxSize: 3, defaultTtlMs: 60_000 });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.set('d', '4'); // 'a'가 퇴거됨

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe('2');
      expect(cache.get('c')).toBe('3');
      expect(cache.get('d')).toBe('4');
    });

    it('get으로 접근하면 LRU 순서가 갱신된다', () => {
      const cache = new CacheManager<string>({ maxSize: 3, defaultTtlMs: 60_000 });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');

      // 'a'에 접근하여 최신으로 갱신
      cache.get('a');

      cache.set('d', '4'); // 'b'가 퇴거됨 ('a'는 최근 접근)

      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe('3');
      expect(cache.get('d')).toBe('4');
    });

    it('퇴거 메트릭을 추적한다', () => {
      const cache = new CacheManager<string>({ maxSize: 2, defaultTtlMs: 60_000 });

      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3'); // 퇴거 발생
      cache.set('d', '4'); // 퇴거 발생

      expect(cache.getMetrics().evictions).toBe(2);
    });
  });

  describe('FR-CM.4: 네임스페이스', () => {
    it('네임스페이스로 테넌트를 격리한다', () => {
      const tenantA = new CacheManager<string>({ namespace: 'tenant-A' });
      const tenantB = new CacheManager<string>({ namespace: 'tenant-B' });

      tenantA.set('users', 'A-users');
      tenantB.set('users', 'B-users');

      expect(tenantA.get('users')).toBe('A-users');
      expect(tenantB.get('users')).toBe('B-users');
    });

    it('네임스페이스 없이도 정상 동작한다', () => {
      const cache = new CacheManager<string>();
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
    });
  });

  describe('FR-CM.5: 캐시 메트릭', () => {
    it('적중/미스를 추적한다', () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 60_000 });
      cache.set('exists', 'value');

      cache.get('exists');     // HIT
      cache.get('exists');     // HIT
      cache.get('missing');    // MISS

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
    });

    it('size를 정확하게 반환한다', () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 60_000 });
      cache.set('a', '1');
      cache.set('b', '2');

      expect(cache.getMetrics().size).toBe(2);

      cache.delete('a');
      expect(cache.getMetrics().size).toBe(1);
    });
  });

  describe('FR-CM.6: getOrSet', () => {
    it('캐시 미스 시 로더를 실행하고 결과를 캐시한다', async () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 60_000 });
      let loadCount = 0;

      const loader = async () => {
        loadCount++;
        return 'loaded-value';
      };

      const result1 = await cache.getOrSet('key1', loader);
      const result2 = await cache.getOrSet('key1', loader);

      expect(result1).toBe('loaded-value');
      expect(result2).toBe('loaded-value');
      expect(loadCount).toBe(1); // 로더는 1번만 호출
    });

    it('동기 로더도 지원한다', async () => {
      const cache = new CacheManager<number>({ defaultTtlMs: 60_000 });

      const result = await cache.getOrSet('num', () => 42);
      expect(result).toBe(42);
    });

    it('getOrSet에 커스텀 TTL을 지정할 수 있다', async () => {
      const cache = new CacheManager<string>({ defaultTtlMs: 60_000 });

      await cache.getOrSet('short', () => 'value', 100);

      await new Promise((r) => setTimeout(r, 150));
      expect(cache.get('short')).toBeUndefined();
    });
  });
});
