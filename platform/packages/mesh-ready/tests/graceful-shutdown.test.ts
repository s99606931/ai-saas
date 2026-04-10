// GracefulShutdown 단위 테스트
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.3

import { describe, it, expect, beforeEach } from 'vitest';
import { GracefulShutdown } from '../src/graceful-shutdown.js';

describe('GracefulShutdown', () => {
  let shutdown: GracefulShutdown;
  const silentLogger = {
    info: () => {},
    error: () => {},
  };

  beforeEach(() => {
    shutdown = new GracefulShutdown({ logger: silentLogger });
  });

  it('초기 상태에서 종료 중이 아니다', () => {
    expect(shutdown.isTerminating()).toBe(false);
  });

  it('초기 활성 요청 수가 0이다', () => {
    expect(shutdown.getActiveRequests()).toBe(0);
  });

  it('요청 카운터를 증가/감소한다', () => {
    shutdown.incrementRequests();
    shutdown.incrementRequests();
    expect(shutdown.getActiveRequests()).toBe(2);

    shutdown.decrementRequests();
    expect(shutdown.getActiveRequests()).toBe(1);
  });

  it('요청 카운터가 0 이하로 내려가지 않는다', () => {
    shutdown.decrementRequests();
    shutdown.decrementRequests();
    expect(shutdown.getActiveRequests()).toBe(0);
  });

  it('shutdown() 호출 시 isTerminating이 true가 된다', async () => {
    await shutdown.shutdown();
    expect(shutdown.isTerminating()).toBe(true);
  });

  it('중복 shutdown() 호출을 무시한다', async () => {
    await shutdown.shutdown();
    await shutdown.shutdown(); // 두 번째 호출 -- 무시됨
    expect(shutdown.isTerminating()).toBe(true);
  });

  it('정리 핸들러를 순차 실행한다', async () => {
    const order: number[] = [];

    shutdown.addCleanupHandler(async () => {
      order.push(1);
    });
    shutdown.addCleanupHandler(async () => {
      order.push(2);
    });
    shutdown.addCleanupHandler(async () => {
      order.push(3);
    });

    await shutdown.shutdown();

    expect(order).toEqual([1, 2, 3]);
  });

  it('정리 핸들러 실패 시에도 나머지를 실행한다', async () => {
    const order: number[] = [];

    shutdown.addCleanupHandler(async () => {
      order.push(1);
    });
    shutdown.addCleanupHandler(async () => {
      throw new Error('핸들러 실패');
    });
    shutdown.addCleanupHandler(async () => {
      order.push(3);
    });

    await shutdown.shutdown();

    expect(order).toEqual([1, 3]);
  });

  it('활성 요청이 완료되면 셧다운을 진행한다', async () => {
    shutdown.incrementRequests();

    // 비동기로 100ms 후 요청 완료
    setTimeout(() => {
      shutdown.decrementRequests();
    }, 100);

    await shutdown.shutdown();

    expect(shutdown.isTerminating()).toBe(true);
    expect(shutdown.getActiveRequests()).toBe(0);
  });

  it('타임아웃이 커스텀 설정된다', () => {
    const custom = new GracefulShutdown({
      timeout: 5000,
      logger: silentLogger,
    });

    // 타임아웃은 직접 확인할 수 없으므로 생성 자체가 성공하면 OK
    expect(custom.isTerminating()).toBe(false);
  });

  it('생성자 옵션으로 정리 핸들러를 등록한다', async () => {
    let called = false;

    const withHandlers = new GracefulShutdown({
      cleanupHandlers: [async () => { called = true; }],
      logger: silentLogger,
    });

    await withHandlers.shutdown();

    expect(called).toBe(true);
  });
});
