// MTU-N390 오프라인 AI 큐 테스트
import { describe, it, expect } from 'vitest';
import { OfflineAiQueueService } from '../offline-ai-queue.js';

describe('MTU-N390 OfflineAiQueue', () => {
  it('FR-N390.1: 항목 enqueue', () => {
    const svc = new OfflineAiQueueService('tenant-n390-a');
    const item = svc.enqueue({ prompt: 'hi' }, 7);
    expect(item.status).toBe('pending');
    expect(item.priority).toBe(7);
  });

  it('FR-N390.2: 우선순위 기반 dequeue', () => {
    const svc = new OfflineAiQueueService('tenant-n390-b');
    svc.enqueue({ prompt: 'low' }, 1);
    svc.enqueue({ prompt: 'high' }, 9);
    const next = svc.dequeue();
    expect(next?.priority).toBe(9);
  });

  it('FR-N390.3: 성공 처리', () => {
    const svc = new OfflineAiQueueService('tenant-n390-c');
    const item = svc.enqueue({ x: 1 });
    const taken = svc.dequeue();
    svc.success(taken!.itemId);
    expect(item.status).toBe('completed');
  });

  it('FR-N390.4: 재시도 실패 후 dead letter', () => {
    const svc = new OfflineAiQueueService('tenant-n390-d', {
      maxAttempts: 2,
      initialBackoffMs: 1,
      maxBackoffMs: 10,
      maxCapacity: 10,
    });
    const item = svc.enqueue({ x: 1 });
    svc.dequeue();
    svc.failure(item.itemId, 'e1');
    svc.dequeue(Date.now() + 100);
    svc.failure(item.itemId, 'e2');
    expect(svc.deadLetter().length).toBeGreaterThan(0);
  });

  it('FR-N390.5: 감사 로그', () => {
    const svc = new OfflineAiQueueService('tenant-n390-e');
    svc.enqueue({ x: 1 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
