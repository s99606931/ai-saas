// EventBus 단위 테스트
// Design Ref: SVC-EVENT-R17 Plan
// Plan SC: FR-EVT.2, FR-EVT.3, FR-EVT.4

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../src/event-bus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus({ maxRetries: 2, retryBaseDelay: 10 });
  });

  describe('발행/구독', () => {
    it('이벤트를 발행하고 구독자가 수신한다', async () => {
      const received: string[] = [];
      bus.on<string>('user.created', (payload) => {
        received.push(payload);
      });

      await bus.emit('user.created', 'user-001');

      expect(received).toEqual(['user-001']);
    });

    it('다중 구독자가 모두 수신한다', async () => {
      let count = 0;
      bus.on('event', () => { count++; });
      bus.on('event', () => { count++; });
      bus.on('event', () => { count++; });

      await bus.emit('event', null);

      expect(count).toBe(3);
    });

    it('구독 해제 후 수신하지 않는다', async () => {
      let count = 0;
      const handler = () => { count++; };
      bus.on('event', handler);
      bus.off('event', handler);

      await bus.emit('event', null);

      expect(count).toBe(0);
    });

    it('once()로 일회성 구독한다', async () => {
      let count = 0;
      bus.once('event', () => { count++; });

      await bus.emit('event', null);
      await bus.emit('event', null);

      expect(count).toBe(1);
    });

    it('비동기 핸들러를 지원한다', async () => {
      let result = '';
      bus.on<string>('async', async (payload) => {
        await new Promise((r) => setTimeout(r, 10));
        result = payload;
      });

      await bus.emit('async', 'async-value');

      expect(result).toBe('async-value');
    });
  });

  describe('와일드카드 패턴 매칭', () => {
    it('*가 단일 세그먼트를 매칭한다', async () => {
      const received: string[] = [];
      bus.on<string>('user.*', (payload) => {
        received.push(payload);
      });

      await bus.emit('user.created', 'created');
      await bus.emit('user.updated', 'updated');
      await bus.emit('user.deleted', 'deleted');
      await bus.emit('order.created', 'order'); // 매칭 안됨

      expect(received).toEqual(['created', 'updated', 'deleted']);
    });

    it('**가 모든 세그먼트를 매칭한다', async () => {
      const received: string[] = [];
      bus.on<string>('**', (payload) => {
        received.push(payload);
      });

      await bus.emit('a', '1');
      await bus.emit('a.b', '2');
      await bus.emit('a.b.c', '3');

      expect(received).toEqual(['1', '2', '3']);
    });

    it('정확한 이벤트명도 매칭한다', async () => {
      let called = false;
      bus.on('exact.match', () => { called = true; });

      await bus.emit('exact.match', null);

      expect(called).toBe(true);
    });
  });

  describe('재시도 + 데드레터 큐', () => {
    it('핸들러 실패 시 재시도한다', async () => {
      let attempts = 0;
      bus.on('retry-test', () => {
        attempts++;
        if (attempts < 3) throw new Error('일시적 오류');
      });

      await bus.emit('retry-test', null);

      expect(attempts).toBe(3); // 1 + 2 재시도
      expect(bus.getDeadLetterCount()).toBe(0); // 성공했으므로 DLQ 없음
    });

    it('최대 재시도 초과 시 데드레터 큐로 이동한다', async () => {
      bus.on('always-fail', () => {
        throw new Error('영구 오류');
      });

      await bus.emit('always-fail', { data: 'test' });

      expect(bus.getDeadLetterCount()).toBe(1);
      const dl = bus.getDeadLetters()[0]!;
      expect(dl.event).toBe('always-fail');
      expect(dl.error).toBe('영구 오류');
      expect(dl.attempts).toBe(3); // 1 + 2 재시도 = 3
    });

    it('데드레터 큐를 비운다', async () => {
      bus.on('fail', () => { throw new Error('err'); });
      await bus.emit('fail', null);

      expect(bus.getDeadLetterCount()).toBe(1);
      bus.clearDeadLetters();
      expect(bus.getDeadLetterCount()).toBe(0);
    });
  });

  describe('통계', () => {
    it('발행/소비 카운트를 추적한다', async () => {
      bus.on('counted', () => {});

      await bus.emit('counted', null);
      await bus.emit('counted', null);

      const stats = bus.getStats();
      expect(stats.published).toBe(2);
      expect(stats.consumed).toBe(2);
    });

    it('실패 카운트를 추적한다', async () => {
      bus.on('fail-stat', () => { throw new Error('err'); });
      await bus.emit('fail-stat', null);

      expect(bus.getStats().failed).toBe(1);
    });

    it('이벤트별 발행 수를 추적한다', async () => {
      bus.on('a', () => {});
      bus.on('b', () => {});

      await bus.emit('a', null);
      await bus.emit('a', null);
      await bus.emit('b', null);

      const stats = bus.getStats();
      expect(stats.byEvent['a']).toBe(2);
      expect(stats.byEvent['b']).toBe(1);
    });

    it('리스너 수를 추적한다', () => {
      const h1 = () => {};
      const h2 = () => {};
      bus.on('e', h1);
      bus.on('e', h2);

      expect(bus.getStats().listenerCount).toBe(2);

      bus.off('e', h1);
      expect(bus.getStats().listenerCount).toBe(1);
    });
  });

  describe('유틸리티', () => {
    it('등록된 이벤트 목록을 반환한다', () => {
      bus.on('a', () => {});
      bus.on('b', () => {});
      bus.on('c.*', () => {});

      expect(bus.getRegisteredEvents()).toEqual(['a', 'b', 'c.*']);
    });

    it('removeAllListeners()가 모든 리스너를 제거한다', () => {
      bus.on('a', () => {});
      bus.on('b', () => {});

      bus.removeAllListeners();

      expect(bus.getRegisteredEvents()).toHaveLength(0);
      expect(bus.getStats().listenerCount).toBe(0);
    });

    it('emitSync()가 비동기로 실행한다', () => {
      let called = false;
      bus.on('sync-test', () => { called = true; });

      bus.emitSync('sync-test', null);

      // fire-and-forget이므로 즉시 확인 시 false일 수 있음
      // 하지만 microtask로 실행되므로 다음 tick에서는 true
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(called).toBe(true);
          resolve();
        }, 50);
      });
    });
  });
});
