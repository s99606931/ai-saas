// Outbox 테스트
// Plan SC: FR-OB.1~FR-OB.6

import { describe, it, expect } from 'vitest';
import { Outbox, MemoryOutboxStore } from '../src/outbox.js';

describe('FR-OB.1: append', () => {
  it('이벤트 추가 후 pending 상태', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    const id = await outbox.append({
      eventType: 'order.created',
      payload: { orderId: 'ord-1' },
    });
    expect(id).toMatch(/^[a-f0-9]{24}$/);

    const pending = await outbox.fetchPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe('pending');
  });

  it('eventType 필수', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    await expect(
      outbox.append({ eventType: '', payload: {} }),
    ).rejects.toThrow();
  });
});

describe('FR-OB.2: fetchPending', () => {
  it('limit 존중', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    for (let i = 0; i < 5; i++) {
      await outbox.append({ eventType: 'test', payload: i });
    }
    const batch = await outbox.fetchPending(3);
    expect(batch).toHaveLength(3);
  });

  it('발행된 이벤트는 제외', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    const id1 = await outbox.append({ eventType: 'a', payload: 1 });
    await outbox.append({ eventType: 'b', payload: 2 });

    await outbox.markPublished(id1);

    const pending = await outbox.fetchPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.eventType).toBe('b');
  });

  it('createdAt 순 정렬', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    await outbox.append({ eventType: 'first', payload: {} });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.append({ eventType: 'second', payload: {} });

    const pending = await outbox.fetchPending();
    expect(pending[0]!.eventType).toBe('first');
    expect(pending[1]!.eventType).toBe('second');
  });
});

describe('FR-OB.3: markPublished', () => {
  it('상태 전이', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    const id = await outbox.append({ eventType: 'x', payload: {} });
    await outbox.markPublished(id);

    const published = await outbox.getPublished();
    expect(published).toHaveLength(1);
    expect(published[0]!.status).toBe('published');
  });

  it('존재하지 않는 ID 거부', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    await expect(outbox.markPublished('ghost')).rejects.toThrow();
  });
});

describe('FR-OB.4: 재시도 카운트', () => {
  it('실패 시 retry 반환 및 카운트 증가', async () => {
    const outbox = new Outbox({ maxRetries: 3 });
    const id = await outbox.append({ eventType: 'x', payload: {} });

    const r1 = await outbox.markFailed(id, new Error('첫 실패'));
    expect(r1).toBe('retry');

    const pending = await outbox.fetchPending();
    expect(pending[0]!.retryCount).toBe(1);
    expect(pending[0]!.lastError).toBe('첫 실패');
  });
});

describe('FR-OB.5: Dead-letter', () => {
  it('maxRetries 초과 시 dead_letter', async () => {
    const outbox = new Outbox({ maxRetries: 2 });
    const id = await outbox.append({ eventType: 'x', payload: {} });

    expect(await outbox.markFailed(id, new Error('1'))).toBe('retry');
    expect(await outbox.markFailed(id, new Error('2'))).toBe('retry');
    expect(await outbox.markFailed(id, new Error('3'))).toBe('dead');

    const dead = await outbox.getDeadLetter();
    expect(dead).toHaveLength(1);
    expect(dead[0]!.status).toBe('dead_letter');
    expect(dead[0]!.retryCount).toBe(3);

    const stillPending = await outbox.fetchPending();
    expect(stillPending).toHaveLength(0);
  });
});

describe('FR-OB.6: 저장소 추상화', () => {
  it('커스텀 저장소 주입', async () => {
    const store = new MemoryOutboxStore();
    const outbox = new Outbox({ maxRetries: 3, store });
    await outbox.append({ eventType: 'x', payload: {} });
    expect(store.size()).toBe(1);
  });

  it('maxRetries 음수 거부', () => {
    expect(() => new Outbox({ maxRetries: -1 })).toThrow();
  });
});

describe('전체 플로우', () => {
  it('발행 루프 시뮬레이션', async () => {
    const outbox = new Outbox({ maxRetries: 5 });

    // 이벤트 추가
    await outbox.append({ eventType: 'user.registered', payload: { userId: 1 } });
    await outbox.append({ eventType: 'order.placed', payload: { orderId: 2 } });
    await outbox.append({ eventType: 'payment.approved', payload: { paymentId: 3 } });

    // 배치 가져오기
    const batch = await outbox.fetchPending(10);
    expect(batch).toHaveLength(3);

    // 두 개 발행 성공
    await outbox.markPublished(batch[0]!.id);
    await outbox.markPublished(batch[1]!.id);

    // 하나 실패
    await outbox.markFailed(batch[2]!.id, new Error('broker down'));

    const remaining = await outbox.fetchPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.retryCount).toBe(1);

    // 재시도 성공
    await outbox.markPublished(remaining[0]!.id);

    expect(await outbox.fetchPending()).toHaveLength(0);
    expect(await outbox.getPublished()).toHaveLength(3);
  });
});
