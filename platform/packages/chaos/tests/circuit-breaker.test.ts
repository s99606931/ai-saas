// Circuit Breaker 단위 테스트
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.2

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError, CircuitBreakerRegistry } from '../src/circuit-breaker.js';

describe('CircuitBreaker -- 상태 전이', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 100,
    });
  });

  it('초기 상태가 CLOSED이다', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('성공 요청에서 CLOSED 상태를 유지한다', async () => {
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('failureThreshold 도달 시 OPEN으로 전환한다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('OPEN');
  });

  it('OPEN 상태에서 요청을 즉시 차단한다', async () => {
    // OPEN 상태로 전환
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }

    await expect(
      breaker.execute(async () => 'should not run'),
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('OPEN -> HALF_OPEN 전환 (타임아웃 후)', async () => {
    // OPEN 상태로 전환
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('OPEN');

    // 타임아웃 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('HALF_OPEN -> CLOSED 전환 (successThreshold 도달)', async () => {
    // OPEN 상태로 전환
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }

    // HALF_OPEN 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(breaker.getState()).toBe('HALF_OPEN');

    // 성공 요청
    await breaker.execute(async () => 'success');
    await breaker.execute(async () => 'success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('HALF_OPEN에서 실패 시 OPEN으로 복귀한다', async () => {
    // OPEN 상태로 전환
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }

    // HALF_OPEN 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(breaker.getState()).toBe('HALF_OPEN');

    // 실패 요청
    try {
      await breaker.execute(async () => { throw new Error('still failing'); });
    } catch {
      // expected
    }
    expect(breaker.getState()).toBe('OPEN');
  });
});

describe('CircuitBreaker -- Fallback', () => {
  it('OPEN 상태에서 fallback 함수가 실행된다', async () => {
    const breaker = new CircuitBreaker({
      name: 'fallback-test',
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
      fallback: () => ({ cached: true, data: 'fallback data' }),
    });

    // OPEN으로 전환
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }

    const result = await breaker.execute(async () => 'should not run');
    expect(result).toEqual({ cached: true, data: 'fallback data' });
  });
});

describe('CircuitBreaker -- 요청 타임아웃', () => {
  it('requestTimeoutMs 초과 시 실패로 처리된다', async () => {
    const breaker = new CircuitBreaker({
      name: 'timeout-test',
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
      requestTimeoutMs: 50,
    });

    await expect(
      breaker.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'too slow';
      }),
    ).rejects.toThrow('요청 타임아웃');
  });
});

describe('CircuitBreaker -- 상태 정보', () => {
  it('getStatus가 전체 통계를 반환한다', async () => {
    const breaker = new CircuitBreaker({
      name: 'stats-test',
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 1000,
    });

    await breaker.execute(async () => 'ok');
    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch {
      // expected
    }

    const status = breaker.getStatus();
    expect(status.name).toBe('stats-test');
    expect(status.state).toBe('CLOSED');
    expect(status.totalRequests).toBe(2);
    expect(status.totalSuccesses).toBe(1);
    expect(status.totalFailures).toBe(1);
  });

  it('reset이 상태를 초기화한다', async () => {
    const breaker = new CircuitBreaker({
      name: 'reset-test',
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
    });

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('OPEN');

    breaker.reset();
    expect(breaker.getState()).toBe('CLOSED');
  });
});

describe('CircuitBreakerRegistry', () => {
  it('다수의 Circuit Breaker를 관리한다', () => {
    const registry = new CircuitBreakerRegistry();

    const b1 = registry.getOrCreate({
      name: 'service-a',
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
    });

    const b2 = registry.getOrCreate({
      name: 'service-b',
      failureThreshold: 5,
      successThreshold: 3,
      timeoutMs: 2000,
    });

    expect(b1).not.toBe(b2);
    expect(registry.getAllStatus()).toHaveLength(2);
  });

  it('동일 이름으로 조회 시 기존 인스턴스를 반환한다', () => {
    const registry = new CircuitBreakerRegistry();
    const config = {
      name: 'service-a',
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
    };

    const b1 = registry.getOrCreate(config);
    const b2 = registry.getOrCreate(config);
    expect(b1).toBe(b2);
  });

  it('개별 및 전체 리셋이 동작한다', async () => {
    const registry = new CircuitBreakerRegistry();

    const breaker = registry.getOrCreate({
      name: 'reset-registry-test',
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
    });

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }
    expect(breaker.getState()).toBe('OPEN');

    registry.reset('reset-registry-test');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
