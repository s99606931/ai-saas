/**
 * DORA 이벤트 큐 테스트
 * Design Ref: MTU-N251 §3.3
 * Plan SC: FR-N251.1
 */

import { EventQueue, DORAEventType, DORAEvent } from '../src/event-queue';

function createEvent(overrides?: Partial<DORAEvent>): DORAEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    type: DORAEventType.Deployment,
    timestamp: new Date().toISOString(),
    team: 'platform',
    service: 'api-gateway',
    environment: 'production',
    ...overrides,
  };
}

describe('EventQueue', () => {
  let queue: EventQueue;

  beforeEach(() => {
    queue = new EventQueue({ maxQueueSize: 100, maxRetries: 3, retryDelayMs: 10 });
  });

  describe('enqueue', () => {
    it('이벤트 큐잉 성공', () => {
      const event = createEvent();
      const result = queue.enqueue(event);

      expect(result).toBe(true);
      expect(queue.length).toBe(1);
    });

    it('중복 이벤트 방지 (같은 ID)', async () => {
      const event = createEvent({ id: 'dup-1' });
      queue.enqueue(event);

      // 먼저 flush로 처리하여 processedIds에 등록
      queue.setHandler(async () => {});
      await queue.flush();

      // 같은 ID 재큐잉 시도
      const result = queue.enqueue(createEvent({ id: 'dup-1' }));
      expect(result).toBe(false);
    });

    it('큐 용량 초과 시 가장 오래된 항목 제거', () => {
      const smallQueue = new EventQueue({ maxQueueSize: 3 });

      smallQueue.enqueue(createEvent({ id: 'e1' }));
      smallQueue.enqueue(createEvent({ id: 'e2' }));
      smallQueue.enqueue(createEvent({ id: 'e3' }));
      smallQueue.enqueue(createEvent({ id: 'e4' }));

      expect(smallQueue.length).toBe(3); // e1이 제거됨
    });
  });

  describe('flush', () => {
    it('핸들러 없으면 오류 반환', async () => {
      queue.enqueue(createEvent());
      const result = await queue.flush();

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('핸들러');
    });

    it('정상 처리', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.setHandler(handler);

      queue.enqueue(createEvent());
      queue.enqueue(createEvent());

      const result = await queue.flush();

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('실패 시 재시도 큐에 추가', async () => {
      let callCount = 0;
      queue.setHandler(async () => {
        callCount++;
        if (callCount <= 1) {
          throw new Error('일시적 오류');
        }
      });

      queue.enqueue(createEvent());

      // 첫 번째 flush: 실패 → 재시도 큐
      const result1 = await queue.flush();
      expect(result1.processed).toBe(0);
      expect(result1.remaining).toBe(1); // 재시도 대기

      // 두 번째 flush: 성공
      const result2 = await queue.flush();
      expect(result2.processed).toBe(1);
      expect(result2.remaining).toBe(0);
    });

    it('최대 재시도 초과 시 실패 처리', async () => {
      const maxRetriesQueue = new EventQueue({ maxRetries: 2 });
      maxRetriesQueue.setHandler(async () => {
        throw new Error('영구 오류');
      });

      maxRetriesQueue.enqueue(createEvent());

      // 1회 시도: retryCount=1 (재시도 큐)
      await maxRetriesQueue.flush();
      expect(maxRetriesQueue.length).toBe(1);

      // 2회 시도: retryCount=2 >= maxRetries(2) → 실패 처리
      const result = await maxRetriesQueue.flush();
      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('영구 오류');
    });

    it('빈 큐 flush 시 빈 결과', async () => {
      queue.setHandler(async () => {});
      const result = await queue.flush();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
    });
  });

  describe('getStats', () => {
    it('초기 통계', () => {
      const stats = queue.getStats();

      expect(stats.queueLength).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.retryPending).toBe(0);
      expect(stats.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('처리 후 통계 업데이트', async () => {
      queue.setHandler(async () => {});

      queue.enqueue(createEvent());
      queue.enqueue(createEvent());
      await queue.flush();

      const stats = queue.getStats();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.queueLength).toBe(0);
    });

    it('실패 후 재시도 대기 통계', async () => {
      queue.setHandler(async () => {
        throw new Error('오류');
      });

      queue.enqueue(createEvent());
      await queue.flush();

      const stats = queue.getStats();
      expect(stats.retryPending).toBe(1);
      expect(stats.queueLength).toBe(1);
    });
  });

  describe('clear', () => {
    it('큐 초기화', () => {
      queue.enqueue(createEvent());
      queue.enqueue(createEvent());
      expect(queue.length).toBe(2);

      queue.clear();
      expect(queue.length).toBe(0);
    });
  });

  describe('이벤트 타입', () => {
    it('모든 이벤트 타입 큐잉 가능', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.setHandler(handler);

      const types = [
        DORAEventType.Deployment,
        DORAEventType.DeploymentFailure,
        DORAEventType.IncidentStart,
        DORAEventType.IncidentResolved,
        DORAEventType.Rollback,
        DORAEventType.Hotfix,
      ];

      for (const type of types) {
        queue.enqueue(createEvent({ type }));
      }

      const result = await queue.flush();
      expect(result.processed).toBe(6);
    });

    it('메타데이터 포함 이벤트', async () => {
      let capturedEvent: DORAEvent | null = null;
      queue.setHandler(async (event) => {
        capturedEvent = event;
      });

      queue.enqueue(createEvent({
        metadata: { duration: 120, commit_count: 5 },
      }));

      await queue.flush();

      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent!.metadata?.duration).toBe(120);
      expect(capturedEvent!.metadata?.commit_count).toBe(5);
    });
  });
});
