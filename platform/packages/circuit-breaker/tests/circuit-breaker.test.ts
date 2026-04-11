// 서킷 브레이커 테스트
// Design Ref: SVC-CIRCUIT-R25 DESIGN §1
// Plan SC: FR-CB.1, FR-CB.2, FR-CB.3, FR-CB.5, FR-CB.6

import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../src/circuit-breaker.js';

describe('CircuitBreaker', () => {
  describe('FR-CB.1: 3-상태 서킷 브레이커', () => {
    it('초기 상태는 CLOSED', () => {
      const cb = new CircuitBreaker({ name: 'test' });
      expect(cb.getState()).toBe('CLOSED');
    });

    it('성공 호출은 CLOSED 상태 유지', async () => {
      const cb = new CircuitBreaker({ name: 'test' });
      const result = await cb.execute(async () => 'ok');
      expect(result).toBe('ok');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('실패해도 최소 호출 수 미달이면 CLOSED 유지', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 5,
        failureThreshold: 0.5,
      });

      // 3번만 실패 (최소 호출 5 미달)
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('FR-CB.2: 실패율 기반 자동 열림', () => {
    it('실패율 >= 50% 이고 최소 호출 수 충족 시 OPEN', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 4,
        failureThreshold: 0.5,
        windowSizeMs: 60000,
      });

      // 2 성공 + 3 실패 = 60% 실패율
      await cb.execute(async () => 'ok');
      await cb.execute(async () => 'ok');
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('OPEN 상태에서 요청 차단', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 60000, // 긴 타임아웃으로 HALF_OPEN 방지
      });

      // 2번 실패 -> OPEN
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe('OPEN');

      // OPEN 상태에서 호출 차단
      await expect(
        cb.execute(async () => 'should-not-run'),
      ).rejects.toThrow(CircuitOpenError);
    });
  });

  describe('FR-CB.3: 반개방 상태 자동 전환', () => {
    it('resetTimeout 경과 후 HALF_OPEN으로 전환', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 50, // 50ms 타임아웃
      });

      // OPEN으로 전환
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }
      expect(cb.getState()).toBe('OPEN');

      // 타임아웃 대기
      await new Promise((r) => setTimeout(r, 100));

      // HALF_OPEN으로 자동 전환
      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('HALF_OPEN에서 성공 시 CLOSED 복귀', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 50,
        halfOpenMaxCalls: 2,
      });

      // OPEN으로 전환
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      await new Promise((r) => setTimeout(r, 100));

      // HALF_OPEN에서 성공 호출
      await cb.execute(async () => 'ok');
      await cb.execute(async () => 'ok');

      expect(cb.getState()).toBe('CLOSED');
    });

    it('HALF_OPEN에서 실패 시 OPEN 복귀', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 50,
      });

      // OPEN으로 전환
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      await new Promise((r) => setTimeout(r, 100));

      // HALF_OPEN에서 실패 -> 즉시 OPEN
      try {
        await cb.execute(async () => { throw new Error('still-fail'); });
      } catch { /* expected */ }

      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('FR-CB.5: 폴백 함수 지원', () => {
    it('OPEN 상태에서 폴백 함수가 실행된다', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 60000,
        fallback: () => 'fallback-value',
      });

      // OPEN으로 전환
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      // 폴백 실행
      const result = await cb.execute(async () => 'should-not-run');
      expect(result).toBe('fallback-value');
    });
  });

  describe('FR-CB.6: 상태 모니터링', () => {
    it('메트릭을 정확히 반환한다', async () => {
      const cb = new CircuitBreaker({ name: 'my-service', minimumCalls: 10 });

      await cb.execute(async () => 'ok');
      await cb.execute(async () => 'ok');
      try {
        await cb.execute(async () => { throw new Error('fail'); });
      } catch { /* expected */ }

      const metrics = cb.getMetrics();
      expect(metrics.name).toBe('my-service');
      expect(metrics.state).toBe('CLOSED');
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successCalls).toBe(2);
      expect(metrics.failureCalls).toBe(1);
      expect(metrics.failureRate).toBeCloseTo(1 / 3, 2);
      expect(metrics.windowCalls).toBe(3);
    });

    it('상태 전환 횟수를 추적한다', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 50,
      });

      // CLOSED -> OPEN (1번)
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      // OPEN -> HALF_OPEN (2번)
      await new Promise((r) => setTimeout(r, 100));
      cb.getState(); // trigger transition

      const metrics = cb.getMetrics();
      expect(metrics.stateTransitions).toBe(2);
    });
  });

  describe('수동 리셋', () => {
    it('reset으로 CLOSED로 복귀한다', async () => {
      const cb = new CircuitBreaker({
        name: 'test',
        minimumCalls: 2,
        failureThreshold: 0.5,
        resetTimeoutMs: 60000,
      });

      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => { throw new Error('fail'); });
        } catch { /* expected */ }
      }

      expect(cb.getState()).toBe('OPEN');

      cb.reset();
      expect(cb.getState()).toBe('CLOSED');

      // 리셋 후 정상 호출 가능
      const result = await cb.execute(async () => 'recovered');
      expect(result).toBe('recovered');
    });
  });
});
