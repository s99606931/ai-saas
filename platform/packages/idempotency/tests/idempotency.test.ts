// Idempotency Manager 테스트
// Plan SC: FR-ID.1~FR-ID.6

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IdempotencyManager,
  MemoryIdempotencyStore,
  withIdempotency,
  IdempotencyConflictError,
  IdempotencyInProgressError,
} from '../src/idempotency.js';

describe('FR-ID.1: begin 상태 머신', () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager({ ttlMs: 10_000 });
  });

  it('첫 요청은 fresh', async () => {
    const result = await manager.begin('key-1', 'hash-a');
    expect(result.state).toBe('fresh');
  });

  it('동일 키 + 동일 해시 + 진행 중 = inProgress', async () => {
    await manager.begin('key-1', 'hash-a');
    const result = await manager.begin('key-1', 'hash-a');
    expect(result.state).toBe('inProgress');
  });

  it('빈 키 거부', async () => {
    await expect(manager.begin('', 'hash')).rejects.toThrow();
  });
});

describe('FR-ID.2: 완료 응답 캐시', () => {
  it('complete 후 동일 키는 캐시 반환', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    await manager.begin('key-1', 'hash-a');
    await manager.complete('key-1', { orderId: 123 });

    const result = await manager.begin('key-1', 'hash-a');
    expect(result.state).toBe('completed');
    if (result.state === 'completed') {
      expect(result.result).toEqual({ orderId: 123 });
    }
  });

  it('존재하지 않는 키 complete 거부', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    await expect(manager.complete('ghost', 'x')).rejects.toThrow();
  });
});

describe('FR-ID.3: 해시 충돌 탐지', () => {
  it('동일 키 + 다른 해시 = conflict', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    await manager.begin('key-1', 'hash-a');
    const result = await manager.begin('key-1', 'hash-b');
    expect(result.state).toBe('conflict');
    if (result.state === 'conflict') {
      expect(result.existingHash).toBe('hash-a');
    }
  });
});

describe('FR-ID.4: TTL 만료', () => {
  it('만료된 레코드는 새로 시작', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10 });
    await manager.begin('key-1', 'hash-a');
    await manager.complete('key-1', 'result');

    await new Promise((r) => setTimeout(r, 20));

    const result = await manager.begin('key-1', 'hash-a');
    expect(result.state).toBe('fresh');
  });

  it('음수 TTL 거부', () => {
    expect(() => new IdempotencyManager({ ttlMs: 0 })).toThrow();
  });

  it('cleanup으로 만료 레코드 일괄 제거', async () => {
    const store = new MemoryIdempotencyStore();
    const manager = new IdempotencyManager({ ttlMs: 10, store });
    await manager.begin('k1', 'h1');
    await manager.begin('k2', 'h2');
    await new Promise((r) => setTimeout(r, 20));
    const removed = store.cleanup();
    expect(removed).toBe(2);
    expect(store.size()).toBe(0);
  });
});

describe('FR-ID.5: withIdempotency 헬퍼', () => {
  it('첫 실행은 cached=false', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    const { result, cached } = await withIdempotency(
      manager,
      'key-1',
      'hash-a',
      async () => ({ value: 42 }),
    );
    expect(result).toEqual({ value: 42 });
    expect(cached).toBe(false);
  });

  it('두 번째 실행은 cached=true', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { value: 100 };
    };

    await withIdempotency(manager, 'key-1', 'hash-a', fn);
    const { cached } = await withIdempotency(manager, 'key-1', 'hash-a', fn);
    expect(cached).toBe(true);
    expect(callCount).toBe(1);
  });

  it('conflict 시 에러', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    await withIdempotency(manager, 'key-1', 'hash-a', async () => 'ok');
    await expect(
      withIdempotency(manager, 'key-1', 'hash-b', async () => 'nope'),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it('실패 후 재시도 가능', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    let attempts = 0;

    await expect(
      withIdempotency(manager, 'key-1', 'hash-a', async () => {
        attempts++;
        throw new Error('첫 시도 실패');
      }),
    ).rejects.toThrow('첫 시도 실패');

    const { result } = await withIdempotency(
      manager,
      'key-1',
      'hash-a',
      async () => {
        attempts++;
        return 'success';
      },
    );
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('inProgress 상태에서 호출 시 에러', async () => {
    const manager = new IdempotencyManager({ ttlMs: 10_000 });
    await manager.begin('key-1', 'hash-a');
    await expect(
      withIdempotency(manager, 'key-1', 'hash-a', async () => 'x'),
    ).rejects.toThrow(IdempotencyInProgressError);
  });
});

describe('FR-ID.6: 저장소 어댑터', () => {
  it('MemoryIdempotencyStore 기본 동작', async () => {
    const store = new MemoryIdempotencyStore();
    await store.set('k1', {
      key: 'k1',
      requestHash: 'h',
      state: 'inProgress',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000,
    });
    expect((await store.get('k1'))?.state).toBe('inProgress');
    await store.delete('k1');
    expect(await store.get('k1')).toBeUndefined();
  });

  it('커스텀 저장소 주입', async () => {
    const store = new MemoryIdempotencyStore();
    const manager = new IdempotencyManager({ ttlMs: 10_000, store });
    await manager.begin('k1', 'h1');
    expect(store.size()).toBe(1);
  });
});
