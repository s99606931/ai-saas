// Graceful Shutdown 테스트
// Design Ref: SVC-GRACEFUL-R26 DESIGN
// Plan SC: FR-GS.1~FR-GS.6

import { describe, it, expect, afterEach, vi } from 'vitest';
import { GracefulShutdown } from '../src/graceful-shutdown.js';

describe('GracefulShutdown', () => {
  let gs: GracefulShutdown;

  afterEach(() => {
    if (gs) gs.destroy();
  });

  describe('FR-GS.1: 시그널 핸들링', () => {
    it('SIGTERM/SIGINT 핸들러를 등록한다', () => {
      gs = new GracefulShutdown({ exitProcess: false, drainDelayMs: 0 });
      const listeners = process.listenerCount('SIGTERM');
      gs.registerSignalHandlers();
      expect(process.listenerCount('SIGTERM')).toBe(listeners + 1);
      expect(process.listenerCount('SIGINT')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('FR-GS.2: 진행 중 요청 추적', () => {
    it('trackRequest/untrackRequest로 카운터를 관리한다', () => {
      gs = new GracefulShutdown({ exitProcess: false, drainDelayMs: 0 });
      expect(gs.getInflightCount()).toBe(0);

      gs.trackRequest();
      gs.trackRequest();
      expect(gs.getInflightCount()).toBe(2);

      gs.untrackRequest();
      expect(gs.getInflightCount()).toBe(1);

      gs.untrackRequest();
      expect(gs.getInflightCount()).toBe(0);
    });

    it('카운터가 0 미만으로 내려가지 않는다', () => {
      gs = new GracefulShutdown({ exitProcess: false, drainDelayMs: 0 });
      gs.untrackRequest();
      gs.untrackRequest();
      expect(gs.getInflightCount()).toBe(0);
    });
  });

  describe('FR-GS.3: 셧다운 단계', () => {
    it('셧다운 시 진행 중 요청 완료를 대기한다', async () => {
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
      });

      gs.trackRequest();

      // 셧다운 시작 (비동기)
      const shutdownPromise = gs.shutdown();

      // 100ms 후 요청 완료
      setTimeout(() => gs.untrackRequest(), 100);

      await shutdownPromise;
      expect(gs.getInflightCount()).toBe(0);
    });

    it('셧다운 콜백이 역순(LIFO)으로 실행된다', async () => {
      const order: string[] = [];
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
      });

      gs.addCallback(async () => { order.push('first'); });
      gs.addCallback(async () => { order.push('second'); });
      gs.addCallback(async () => { order.push('third'); });

      await gs.shutdown();

      expect(order).toEqual(['third', 'second', 'first']);
    });

    it('콜백 실패는 무시하고 다음 콜백을 실행한다', async () => {
      const order: string[] = [];
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
      });

      gs.addCallback(async () => { order.push('first'); });
      gs.addCallback(async () => { throw new Error('boom'); });
      gs.addCallback(async () => { order.push('third'); });

      await gs.shutdown();

      expect(order).toEqual(['third', 'first']);
    });
  });

  describe('FR-GS.4: 강제 종료 타임아웃', () => {
    it('forceTimeout 내에 정상 종료', async () => {
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 1000,
      });

      const start = Date.now();
      await gs.shutdown();
      const duration = Date.now() - start;

      // 강제 종료 없이 즉시 완료
      expect(duration).toBeLessThan(500);
    });
  });

  describe('FR-GS.5: 셧다운 콜백 등록', () => {
    it('여러 콜백을 등록하고 실행한다', async () => {
      const executed: string[] = [];
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
      });

      gs.addCallback(async () => { executed.push('db-close'); });
      gs.addCallback(async () => { executed.push('redis-close'); });
      gs.addCallback(async () => { executed.push('event-bus-close'); });

      await gs.shutdown();

      expect(executed).toHaveLength(3);
      expect(executed).toContain('db-close');
      expect(executed).toContain('redis-close');
      expect(executed).toContain('event-bus-close');
    });
  });

  describe('FR-GS.6: 셧다운 상태 조회', () => {
    it('초기 상태는 false', () => {
      gs = new GracefulShutdown({ exitProcess: false, drainDelayMs: 0 });
      expect(gs.isShuttingDown()).toBe(false);
    });

    it('셧다운 시작 후 true', async () => {
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
      });

      const promise = gs.shutdown();
      expect(gs.isShuttingDown()).toBe(true);
      await promise;
    });

    it('onShutdown 콜백이 호출된다', async () => {
      const onShutdown = vi.fn();
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
        onShutdown,
      });

      await gs.shutdown();
      expect(onShutdown).toHaveBeenCalledTimes(1);
    });

    it('중복 셧다운 호출은 무시된다', async () => {
      const onShutdown = vi.fn();
      gs = new GracefulShutdown({
        exitProcess: false,
        drainDelayMs: 0,
        forceTimeoutMs: 5000,
        onShutdown,
      });

      await Promise.all([gs.shutdown(), gs.shutdown(), gs.shutdown()]);
      expect(onShutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('리소스를 정리한다', () => {
      gs = new GracefulShutdown({ exitProcess: false, drainDelayMs: 0 });
      gs.trackRequest();
      gs.addCallback(async () => {});

      gs.destroy();
      expect(gs.getInflightCount()).toBe(0);
      expect(gs.isShuttingDown()).toBe(false);
    });
  });
});
