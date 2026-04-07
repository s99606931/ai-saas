// Circuit Breaker 단위 테스트
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.9 (운영 안정성 보완)
// CSAP: D-07 가용성 — 장애 격리

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreakerManager, CircuitOpenError } from '../../src/lib/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreakerManager;

  beforeEach(() => {
    cb = new CircuitBreakerManager({
      failureThreshold: 3,
      resetTimeout: 100,   // 테스트용 100ms
      requestTimeout: 500, // 테스트용 500ms
    });
  });

  it('TC-CB-01: 정상 요청은 CLOSED 상태에서 통과한다', async () => {
    const result = await cb.execute('test-svc', async () => 'success');
    expect(result).toBe('success');
    expect(cb.getStatus('test-svc').state).toBe('CLOSED');
  });

  it('TC-CB-02: failureThreshold 미만 실패는 CLOSED 유지한다', async () => {
    // 2회 실패 (threshold=3)
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('test-svc').state).toBe('CLOSED');
    expect(cb.getStatus('test-svc').failureCount).toBe(2);
  });

  it('TC-CB-03: failureThreshold 도달 시 OPEN으로 전환된다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('test-svc').state).toBe('OPEN');
  });

  it('TC-CB-04: OPEN 상태에서 요청은 CircuitOpenError를 던진다', async () => {
    // OPEN 전환
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }

    await expect(
      cb.execute('test-svc', async () => 'should-not-reach'),
    ).rejects.toThrow(CircuitOpenError);
  });

  it('TC-CB-05: CircuitOpenError에 serviceId와 retryAfterMs가 포함된다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('my-service', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }

    try {
      await cb.execute('my-service', async () => 'nope');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      const cbError = error as CircuitOpenError;
      expect(cbError.serviceId).toBe('my-service');
      expect(cbError.retryAfterMs).toBeGreaterThan(0);
      expect(cbError.retryAfterMs).toBeLessThanOrEqual(100);
    }
  });

  it('TC-CB-06: resetTimeout 후 HALF_OPEN으로 전환되어 요청을 허용한다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('test-svc').state).toBe('OPEN');

    // resetTimeout 대기
    await new Promise((resolve) => setTimeout(resolve, 150));

    // HALF_OPEN에서 요청 통과
    const result = await cb.execute('test-svc', async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getStatus('test-svc').state).toBe('HALF_OPEN');
  });

  it('TC-CB-07: HALF_OPEN에서 2회 연속 성공 시 CLOSED로 복귀한다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    await cb.execute('test-svc', async () => 'ok1');
    expect(cb.getStatus('test-svc').state).toBe('HALF_OPEN');

    await cb.execute('test-svc', async () => 'ok2');
    expect(cb.getStatus('test-svc').state).toBe('CLOSED');
  });

  it('TC-CB-08: HALF_OPEN에서 실패하면 다시 OPEN으로 전환된다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    // HALF_OPEN에서 실패
    try {
      await cb.execute('test-svc', async () => { throw new Error('still broken'); });
    } catch { /* expected */ }

    expect(cb.getStatus('test-svc').state).toBe('OPEN');
  });

  it('TC-CB-09: 성공 후 failureCount가 0으로 리셋된다', async () => {
    // 2회 실패
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('test-svc').failureCount).toBe(2);

    // 1회 성공
    await cb.execute('test-svc', async () => 'ok');
    expect(cb.getStatus('test-svc').failureCount).toBe(0);
  });

  it('TC-CB-10: 서로 다른 서비스는 독립적인 Circuit을 갖는다', async () => {
    // svc-a: OPEN
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('svc-a', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('svc-a').state).toBe('OPEN');

    // svc-b: 여전히 CLOSED
    const result = await cb.execute('svc-b', async () => 'ok');
    expect(result).toBe('ok');
    expect(cb.getStatus('svc-b').state).toBe('CLOSED');
  });

  it('TC-CB-11: reset()으로 Circuit을 수동 리셋할 수 있다', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute('test-svc', async () => { throw new Error('fail'); });
      } catch { /* expected */ }
    }
    expect(cb.getStatus('test-svc').state).toBe('OPEN');

    cb.reset('test-svc');
    expect(cb.getStatus('test-svc').state).toBe('CLOSED');
    expect(cb.getStatus('test-svc').failureCount).toBe(0);
  });

  it('TC-CB-12: getAllStatus()로 전체 Circuit 상태를 조회할 수 있다', async () => {
    await cb.execute('svc-a', async () => 'ok');
    await cb.execute('svc-b', async () => 'ok');

    const statuses = cb.getAllStatus();
    expect(statuses).toHaveLength(2);
    expect(statuses.map((s) => s.serviceId).sort()).toEqual(['svc-a', 'svc-b']);
  });

  it('TC-CB-13: requestTimeout 초과 시 실패로 처리된다', async () => {
    const slowCb = new CircuitBreakerManager({
      failureThreshold: 3,
      resetTimeout: 100,
      requestTimeout: 50, // 50ms 타임아웃
    });

    await expect(
      slowCb.execute('slow-svc', () => new Promise((resolve) => setTimeout(() => resolve('late'), 200))),
    ).rejects.toThrow('타임아웃');
  });
});
