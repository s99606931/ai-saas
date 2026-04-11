// Rate Limiter 테스트
// Design Ref: SVC-RATELIMIT-R27 DESIGN
// Plan SC: FR-RL.1~FR-RL.5

import { describe, it, expect, afterEach } from 'vitest';
import { RateLimiter } from '../src/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  afterEach(() => {
    if (limiter) limiter.destroy();
  });

  describe('FR-RL.1: Sliding Window Counter', () => {
    it('윈도우 내 최대 요청 수까지 허용한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
      const now = 1000;

      for (let i = 0; i < 5; i++) {
        const result = limiter.consume('key1', now + i);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.consume('key1', now + 5);
      expect(result.allowed).toBe(false);
    });

    it('윈도우 경과 후 카운터가 리셋된다', () => {
      limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
      const now = 1000;

      // 3건 소진
      limiter.consume('key1', now);
      limiter.consume('key1', now + 1);
      limiter.consume('key1', now + 2);

      // 한도 초과
      expect(limiter.consume('key1', now + 3).allowed).toBe(false);

      // 2윈도우 경과 후 완전 리셋
      const result = limiter.consume('key1', now + 2001);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('Sliding Window 가중치를 적용한다', () => {
      limiter = new RateLimiter({ windowMs: 1000, maxRequests: 10 });

      // 이전 윈도우에 8건
      for (let i = 0; i < 8; i++) {
        limiter.consume('key1', 100 + i);
      }

      // 다음 윈도우 시작 후 250ms 경과 (이전 윈도우 75% 가중)
      // 가중 카운트 = 0 + 8 * 0.75 = 6
      const result = limiter.consume('key1', 1350);
      expect(result.allowed).toBe(true);

      // 추가 3건 (가중 = 3 + 8*0.75 = 9 → 아직 허용)
      limiter.consume('key1', 1351);
      limiter.consume('key1', 1352);
      const r3 = limiter.consume('key1', 1353);
      expect(r3.allowed).toBe(true);
    });
  });

  describe('FR-RL.2: 테넌트별 독립 Rate Limit', () => {
    it('서로 다른 키는 독립적으로 카운트한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
      const now = 1000;

      // tenant-A: 3건 소진
      limiter.consume('tenant-A', now);
      limiter.consume('tenant-A', now + 1);
      limiter.consume('tenant-A', now + 2);
      expect(limiter.consume('tenant-A', now + 3).allowed).toBe(false);

      // tenant-B: 독립적으로 허용
      expect(limiter.consume('tenant-B', now + 4).allowed).toBe(true);
      expect(limiter.consume('tenant-B', now + 5).allowed).toBe(true);
    });

    it('활성 키 수를 추적한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });
      expect(limiter.getActiveKeyCount()).toBe(0);

      limiter.consume('a', 1000);
      limiter.consume('b', 1000);
      limiter.consume('c', 1000);
      expect(limiter.getActiveKeyCount()).toBe(3);
    });
  });

  describe('FR-RL.3: 429 응답 정보', () => {
    it('거부 시 retryAfter를 포함한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 });
      const now = 10_000;

      limiter.consume('key1', now);
      const result = limiter.consume('key1', now + 100);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remaining).toBe(0);
    });

    it('허용 시 limit, remaining, resetAt을 포함한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 });
      const now = 1000;

      const result = limiter.consume('key1', now);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBeLessThan(10);
      expect(result.resetAt).toBe(now + 60_000);
      expect(result.retryAfter).toBeUndefined();
    });
  });

  describe('FR-RL.4: 메트릭 조회', () => {
    it('peek로 카운터 증가 없이 상태를 조회한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 });
      const now = 1000;

      limiter.consume('key1', now);
      limiter.consume('key1', now + 1);

      const peek1 = limiter.peek('key1', now + 2);
      const peek2 = limiter.peek('key1', now + 3);

      // peek는 카운터를 증가시키지 않으므로 동일한 remaining
      expect(peek1.remaining).toBe(peek2.remaining);
      expect(peek1.limit).toBe(10);
    });

    it('존재하지 않는 키는 전체 잔여량을 반환한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });

      const result = limiter.peek('nonexistent', 1000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });
  });

  describe('FR-RL.5: 동적 설정 변경', () => {
    it('런타임에 maxRequests를 변경할 수 있다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
      const now = 1000;

      // 5건 소진
      for (let i = 0; i < 5; i++) {
        limiter.consume('key1', now + i);
      }
      expect(limiter.consume('key1', now + 5).allowed).toBe(false);

      // 한도 상향
      limiter.updateOptions({ maxRequests: 10 });
      expect(limiter.consume('key1', now + 6).allowed).toBe(true);
    });

    it('특정 키를 리셋할 수 있다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 });
      const now = 1000;

      limiter.consume('key1', now);
      expect(limiter.consume('key1', now + 1).allowed).toBe(false);

      limiter.reset('key1');
      expect(limiter.consume('key1', now + 2).allowed).toBe(true);
    });

    it('모든 키를 리셋할 수 있다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 });
      const now = 1000;

      limiter.consume('a', now);
      limiter.consume('b', now);

      limiter.resetAll();
      expect(limiter.getActiveKeyCount()).toBe(0);
      expect(limiter.consume('a', now + 1).allowed).toBe(true);
      expect(limiter.consume('b', now + 1).allowed).toBe(true);
    });
  });

  describe('destroy', () => {
    it('리소스를 정리한다', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100 });
      limiter.consume('key1', 1000);
      limiter.consume('key2', 1000);

      limiter.destroy();
      expect(limiter.getActiveKeyCount()).toBe(0);
    });
  });
});
