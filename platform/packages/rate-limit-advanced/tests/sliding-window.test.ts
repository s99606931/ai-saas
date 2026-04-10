// Sliding Window Counter 테스트
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.1
// CSAP: D-10 접근 제어

import { describe, it, expect, afterEach } from 'vitest';
import { SlidingWindowCounter } from '../src/sliding-window.js';

describe('SlidingWindowCounter', () => {
  let counter: SlidingWindowCounter;

  afterEach(() => {
    if (counter) counter.destroy();
  });

  describe('기본 동작', () => {
    it('첫 요청에서 count=1을 반환한다', () => {
      counter = new SlidingWindowCounter(60_000);
      const result = counter.increment('test', 100, 1000);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(99);
      expect(result.exceeded).toBe(false);
    });

    it('한도에 도달하면 exceeded=true를 반환한다', () => {
      counter = new SlidingWindowCounter(60_000);
      const now = 1000;
      for (let i = 0; i < 10; i++) {
        counter.increment('test', 10, now);
      }
      const result = counter.increment('test', 10, now);
      expect(result.exceeded).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('remaining이 0 이하로 떨어지지 않는다', () => {
      counter = new SlidingWindowCounter(60_000);
      for (let i = 0; i < 15; i++) {
        counter.increment('test', 10, 1000);
      }
      const result = counter.peek('test', 10, 1000);
      expect(result.remaining).toBe(0);
    });
  });

  describe('윈도우 회전', () => {
    it('새 윈도우에서 이전 카운트를 반영한다', () => {
      counter = new SlidingWindowCounter(60_000);
      // 윈도우 1: 50개 요청
      for (let i = 0; i < 50; i++) {
        counter.increment('test', 100, 1000);
      }

      // 윈도우 2 시작 직후 (1ms 경과): 이전 50 x ~1.0 + 현재 0 = ~50
      const result = counter.peek('test', 100, 61_001);
      expect(result.count).toBeLessThanOrEqual(50);
      expect(result.count).toBeGreaterThanOrEqual(49);
    });

    it('윈도우 2 중간에서 이전 가중치가 줄어든다', () => {
      counter = new SlidingWindowCounter(60_000);
      for (let i = 0; i < 60; i++) {
        counter.increment('test', 100, 1000);
      }

      // 윈도우 2의 50% 지점: 이전 60 x 0.5 = 30
      const result = counter.peek('test', 100, 91_000);
      expect(result.count).toBeLessThanOrEqual(31);
      expect(result.count).toBeGreaterThanOrEqual(29);
    });

    it('2개 윈도우 이상 지나면 완전 리셋된다', () => {
      counter = new SlidingWindowCounter(60_000);
      for (let i = 0; i < 50; i++) {
        counter.increment('test', 100, 1000);
      }

      // 3개 윈도우 후
      const result = counter.peek('test', 100, 181_000);
      expect(result.count).toBe(0);
      expect(result.remaining).toBe(100);
    });
  });

  describe('다중 키', () => {
    it('키별로 독립적으로 카운트한다', () => {
      counter = new SlidingWindowCounter(60_000);
      counter.increment('key-a', 100, 1000);
      counter.increment('key-a', 100, 1000);
      counter.increment('key-b', 100, 1000);

      expect(counter.peek('key-a', 100, 1000).count).toBe(2);
      expect(counter.peek('key-b', 100, 1000).count).toBe(1);
    });

    it('reset()이 특정 키만 초기화한다', () => {
      counter = new SlidingWindowCounter(60_000);
      counter.increment('key-a', 100, 1000);
      counter.increment('key-b', 100, 1000);

      counter.reset('key-a');

      expect(counter.peek('key-a', 100, 1000).count).toBe(0);
      expect(counter.peek('key-b', 100, 1000).count).toBe(1);
    });

    it('getKeyCount()가 추적 중인 키 수를 반환한다', () => {
      counter = new SlidingWindowCounter(60_000);
      counter.increment('key-a', 100, 1000);
      counter.increment('key-b', 100, 1000);
      counter.increment('key-c', 100, 1000);

      expect(counter.getKeyCount()).toBe(3);
    });
  });

  describe('retryAfterMs', () => {
    it('한도 초과 시 대기 시간을 반환한다', () => {
      counter = new SlidingWindowCounter(60_000);
      for (let i = 0; i < 10; i++) {
        counter.increment('test', 10, 10_000);
      }
      const result = counter.increment('test', 10, 10_000);
      expect(result.exceeded).toBe(true);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    });

    it('한도 미만 시 retryAfterMs=0이다', () => {
      counter = new SlidingWindowCounter(60_000);
      const result = counter.increment('test', 100, 1000);
      expect(result.retryAfterMs).toBe(0);
    });
  });

  describe('resetAt', () => {
    it('현재 윈도우 종료 시각을 반환한다', () => {
      counter = new SlidingWindowCounter(60_000);
      const result = counter.increment('test', 100, 10_000);
      expect(result.resetAt).toBe(10_000 + 60_000);
    });
  });
});
