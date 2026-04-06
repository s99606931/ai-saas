// 알림 이벤트 버스 (경량 인메모리)
// Design Ref: DESIGN-MTU-Q2 §3 FR-P11.4
// Plan SC: FR-P11.4
// NOTE: BullMQ 대신 EventEmitter 기반 경량 구현. 분산 환경 전환 시 BullMQ로 교체 예정.

import { EventEmitter } from 'node:events';

/**
 * 알림 이벤트 타입 정의
 */
export interface NotificationEventMap {
  'user.created': { userId: string; email: string; tenantId: string; name: string };
  'user.deactivated': { userId: string; tenantId: string };
  'subscription.created': { tenantId: string; planName: string };
  'subscription.expiry_warning': { tenantId: string; daysLeft: number };
  'security.login_failure': { userId: string; ip: string; attempts: number };
  'security.account_locked': { userId: string; ip: string; tenantId: string };
  'compliance.check_completed': { tenantId: string; score: number };
}

type EventType = keyof NotificationEventMap;

/**
 * 알림 이벤트 버스
 * Node.js EventEmitter 래퍼로 타입 안전한 이벤트 처리 제공
 */
class NotificationEventBus {
  private emitter: EventEmitter;
  private handlerCount: number;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // 이벤트 타입당 충분한 리스너
    this.handlerCount = 0;
  }

  /**
   * 이벤트 구독 등록
   */
  on<T extends EventType>(
    event: T,
    handler: (payload: NotificationEventMap[T]) => Promise<void> | void,
  ): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
    this.handlerCount++;
  }

  /**
   * 이벤트 발행 (비동기 fire-and-forget)
   * 핸들러 오류는 로깅만 하고 전파하지 않음
   */
  async emit<T extends EventType>(
    event: T,
    payload: NotificationEventMap[T],
  ): Promise<void> {
    const listeners = this.emitter.listeners(event);
    const results = listeners.map(async (listener) => {
      try {
        await (listener as (p: NotificationEventMap[T]) => Promise<void>)(payload);
      } catch (error) {
        console.error(`[event-bus] 이벤트 핸들러 오류 (${event}):`, error);
      }
    });

    await Promise.allSettled(results);
  }

  /**
   * 이벤트 구독 해제
   * handlerCount를 정확히 감소시켜 카운터 정합성 유지
   */
  off<T extends EventType>(
    event: T,
    handler: (payload: NotificationEventMap[T]) => Promise<void> | void,
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
    if (this.handlerCount > 0) {
      this.handlerCount--;
    }
  }

  /**
   * 등록된 핸들러 수 반환 (모니터링용)
   */
  getHandlerCount(): number {
    return this.handlerCount;
  }

  /**
   * 특정 이벤트의 리스너 수 반환
   */
  getListenerCount(event: EventType): number {
    return this.emitter.listenerCount(event);
  }
}

/** 싱글턴 이벤트 버스 인스턴스 */
export const notificationEventBus = new NotificationEventBus();
