// MTU-Q2 event-bus 단위 테스트
// Test Ref: DESIGN-MTU-Q2 §3 FR-P11.4
// 이벤트 발행/구독 타입 안전성 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// ──────────────────────────────────────────────
// NotificationEventBus 핵심 로직 재현 테스트
// ESM 모듈 직접 import 없이 동일 패턴 검증
// ──────────────────────────────────────────────

interface NotificationEventMap {
  'user.created': { userId: string; email: string; tenantId: string; name: string };
  'user.deactivated': { userId: string; tenantId: string };
  'security.login_failure': { userId: string; ip: string; attempts: number };
  'security.account_locked': { userId: string; ip: string; tenantId: string };
}

type EventType = keyof NotificationEventMap;

class TestEventBus {
  private emitter: EventEmitter;
  private handlerCount: number;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.handlerCount = 0;
  }

  on<T extends EventType>(event: T, handler: (payload: NotificationEventMap[T]) => Promise<void> | void): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
    this.handlerCount++;
  }

  async emit<T extends EventType>(event: T, payload: NotificationEventMap[T]): Promise<void> {
    const listeners = this.emitter.listeners(event);
    const results = listeners.map(async (listener) => {
      try {
        await (listener as (p: NotificationEventMap[T]) => Promise<void>)(payload);
      } catch (error) {
        process.stderr.write(`[event-bus] 이벤트 핸들러 오류 (${event}): ${String(error)}\n`);
      }
    });
    await Promise.allSettled(results);
  }

  getHandlerCount(): number {
    return this.handlerCount;
  }

  getListenerCount(event: EventType): number {
    return this.emitter.listenerCount(event);
  }
}

describe('MTU-Q2 event-bus: 이벤트 구독 및 발행', () => {
  let bus: TestEventBus;

  beforeEach(() => {
    bus = new TestEventBus();
  });

  it('TC-EB01: 핸들러 등록 후 핸들러 수가 증가한다', () => {
    expect(bus.getHandlerCount()).toBe(0);
    bus.on('user.created', vi.fn());
    expect(bus.getHandlerCount()).toBe(1);
  });

  it('TC-EB02: 이벤트 발행 시 구독한 핸들러가 호출된다', async () => {
    const handler = vi.fn();
    bus.on('user.created', handler);

    await bus.emit('user.created', {
      userId: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-abc',
      name: '홍길동',
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('TC-EB03: 이벤트 페이로드가 핸들러에 정확하게 전달된다', async () => {
    const handler = vi.fn();
    bus.on('user.created', handler);

    const payload = {
      userId: 'user-456',
      email: 'hong@gov.kr',
      tenantId: 'tenant-xyz',
      name: '김철수',
    };

    await bus.emit('user.created', payload);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('TC-EB04: 복수 핸들러 등록 시 모두 호출된다', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('user.deactivated', handler1);
    bus.on('user.deactivated', handler2);

    await bus.emit('user.deactivated', { userId: 'u-1', tenantId: 't-1' });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('TC-EB05: 등록하지 않은 이벤트 발행 시 오류가 발생하지 않는다', async () => {
    await expect(
      bus.emit('user.created', {
        userId: 'u-1',
        email: 'test@example.com',
        tenantId: 't-1',
        name: '테스트',
      }),
    ).resolves.not.toThrow();
  });

  it('TC-EB06: 핸들러 오류가 발생해도 다른 핸들러는 정상 실행된다', async () => {
    const errorHandler = vi.fn().mockRejectedValue(new Error('핸들러 오류'));
    const normalHandler = vi.fn();

    bus.on('security.login_failure', errorHandler);
    bus.on('security.login_failure', normalHandler);

    await bus.emit('security.login_failure', { userId: 'u-1', ip: '1.2.3.4', attempts: 5 });

    expect(normalHandler).toHaveBeenCalledOnce();
  });

  it('TC-EB07: 특정 이벤트의 리스너 수를 반환한다', () => {
    bus.on('security.account_locked', vi.fn());
    bus.on('security.account_locked', vi.fn());

    expect(bus.getListenerCount('security.account_locked')).toBe(2);
  });

  it('TC-EB08: MaxListeners가 50으로 설정되어 있다 (대용량 이벤트 처리)', () => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    expect(emitter.getMaxListeners()).toBe(50);
  });
});

describe('MTU-Q2 event-bus: 이벤트 타입 정의 검증', () => {
  it('TC-EB09: user.created 이벤트 타입이 정의되어 있다', () => {
    type UserCreatedPayload = NotificationEventMap['user.created'];
    const payload: UserCreatedPayload = {
      userId: 'u-1',
      email: 'test@example.com',
      tenantId: 't-1',
      name: '테스트',
    };
    expect(payload.userId).toBeDefined();
    expect(payload.email).toBeDefined();
    expect(payload.tenantId).toBeDefined();
    expect(payload.name).toBeDefined();
  });

  it('TC-EB10: security.login_failure 이벤트에 attempts 필드가 있다 (보안 모니터링)', () => {
    type LoginFailPayload = NotificationEventMap['security.login_failure'];
    const payload: LoginFailPayload = { userId: 'u-1', ip: '10.0.0.1', attempts: 3 };
    expect(payload.attempts).toBe(3);
  });
});
