// 타입 안전 이벤트 버스
// Design Ref: SVC-EVENT-R17 Plan
// Plan SC: FR-EVT.2
// CSAP: D-06 침해사고 관리 -- 이벤트 추적

/**
 * 이벤트 핸들러 함수 타입
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * 이벤트 통계
 */
export interface EventStats {
  /** 총 발행 수 */
  published: number;
  /** 총 소비 수 (핸들러 호출) */
  consumed: number;
  /** 실패 수 */
  failed: number;
  /** 등록된 리스너 수 */
  listenerCount: number;
  /** 이벤트별 발행 수 */
  byEvent: Record<string, number>;
}

/**
 * 데드레터 큐 항목
 */
export interface DeadLetterItem {
  /** 이벤트명 */
  event: string;
  /** 페이로드 */
  payload: unknown;
  /** 에러 메시지 */
  error: string;
  /** 실패 시각 */
  timestamp: string;
  /** 시도 횟수 */
  attempts: number;
}

/**
 * 이벤트 버스 옵션
 */
export interface EventBusOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 재시도 기본 대기 시간 ms (기본: 100) */
  retryBaseDelay?: number;
  /** 데드레터 큐 최대 크기 (기본: 1000) */
  maxDeadLetters?: number;
}

/**
 * 이벤트 버스
 *
 * 프로세스 내 pub/sub 이벤트 시스템.
 * 와일드카드 패턴 매칭, 재시도, 데드레터 큐를 지원합니다.
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly deadLetterQueue: DeadLetterItem[] = [];
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly maxDeadLetters: number;
  private stats: EventStats = {
    published: 0,
    consumed: 0,
    failed: 0,
    listenerCount: 0,
    byEvent: {},
  };

  constructor(options: EventBusOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseDelay = options.retryBaseDelay ?? 100;
    this.maxDeadLetters = options.maxDeadLetters ?? 1000;
  }

  /**
   * 이벤트 구독
   *
   * 와일드카드 지원: `user.*` → `user.created`, `user.updated` 등
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
    this.stats.listenerCount++;
  }

  /**
   * 이벤트 구독 해제
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): boolean {
    const handlers = this.handlers.get(event);
    if (!handlers) return false;

    const removed = handlers.delete(handler as EventHandler);
    if (removed) {
      this.stats.listenerCount--;
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
    return removed;
  }

  /**
   * 일회성 이벤트 구독
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = async (payload) => {
      this.off(event, wrapper);
      await handler(payload);
    };
    this.on(event, wrapper);
  }

  /**
   * 이벤트 발행
   *
   * 매칭되는 모든 핸들러를 비동기로 실행합니다.
   * 실패 시 재시도 후 데드레터 큐로 이동합니다.
   */
  async emit<T = unknown>(event: string, payload: T): Promise<void> {
    this.stats.published++;
    this.stats.byEvent[event] = (this.stats.byEvent[event] ?? 0) + 1;

    const matchingHandlers = this.getMatchingHandlers(event);

    for (const handler of matchingHandlers) {
      await this.executeWithRetry(event, payload, handler);
    }
  }

  /**
   * 동기 이벤트 발행 (fire-and-forget)
   */
  emitSync<T = unknown>(event: string, payload: T): void {
    this.emit(event, payload).catch(() => {
      // fire-and-forget: 에러는 데드레터 큐에서 처리
    });
  }

  /**
   * 데드레터 큐 조회
   */
  getDeadLetters(): readonly DeadLetterItem[] {
    return this.deadLetterQueue;
  }

  /**
   * 데드레터 큐 크기
   */
  getDeadLetterCount(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * 데드레터 큐 비우기
   */
  clearDeadLetters(): void {
    this.deadLetterQueue.length = 0;
  }

  /**
   * 이벤트 통계 반환
   */
  getStats(): Readonly<EventStats> {
    return { ...this.stats };
  }

  /**
   * 등록된 이벤트 목록
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 전체 리스너 제거
   */
  removeAllListeners(): void {
    this.handlers.clear();
    this.stats.listenerCount = 0;
  }

  /**
   * 와일드카드 패턴 매칭으로 핸들러 수집
   */
  private getMatchingHandlers(event: string): EventHandler[] {
    const matched: EventHandler[] = [];

    for (const [pattern, handlers] of this.handlers) {
      if (this.matchPattern(pattern, event)) {
        for (const h of handlers) {
          matched.push(h);
        }
      }
    }

    return matched;
  }

  /**
   * 와일드카드 패턴 매칭
   *
   * `*` → 단일 세그먼트 매칭 (예: `user.*` → `user.created`)
   * `**` → 모든 세그먼트 매칭 (예: `user.**` → `user.created.v2`)
   */
  private matchPattern(pattern: string, event: string): boolean {
    if (pattern === event) return true;
    if (pattern === '**') return true;

    const patternParts = pattern.split('.');
    const eventParts = event.split('.');

    let pi = 0;
    let ei = 0;

    while (pi < patternParts.length && ei < eventParts.length) {
      if (patternParts[pi] === '**') return true;
      if (patternParts[pi] === '*') {
        pi++;
        ei++;
        continue;
      }
      if (patternParts[pi] !== eventParts[ei]) return false;
      pi++;
      ei++;
    }

    return pi === patternParts.length && ei === eventParts.length;
  }

  /**
   * 재시도 포함 핸들러 실행
   */
  private async executeWithRetry(
    event: string,
    payload: unknown,
    handler: EventHandler,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await handler(payload);
        this.stats.consumed++;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.maxRetries) {
          // 지수 백오프
          const delay = this.retryBaseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    // 모든 재시도 실패 → 데드레터 큐
    this.stats.failed++;
    this.addToDeadLetterQueue({
      event,
      payload,
      error: lastError?.message ?? 'Unknown error',
      timestamp: new Date().toISOString(),
      attempts: this.maxRetries + 1,
    });
  }

  /**
   * 데드레터 큐에 추가 (최대 크기 제한)
   */
  private addToDeadLetterQueue(item: DeadLetterItem): void {
    this.deadLetterQueue.push(item);
    if (this.deadLetterQueue.length > this.maxDeadLetters) {
      this.deadLetterQueue.shift();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
