// 서킷 브레이커 -- 캐스케이딩 장애 방지
// Design Ref: SVC-CIRCUIT-R25 DESIGN §1
// Plan SC: FR-CB.1, FR-CB.2, FR-CB.3, FR-CB.5, FR-CB.6
// CSAP: D-14 시스템 가용성

/**
 * 서킷 상태
 * Plan SC: FR-CB.1
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * 서킷 브레이커 옵션
 */
export interface CircuitBreakerOptions {
  /** 서킷 이름 (모니터링/로깅용) */
  name: string;
  /** 실패율 임계값 (기본: 0.5 = 50%) */
  failureThreshold?: number;
  /** 실패율 계산 최소 호출 수 (기본: 5) */
  minimumCalls?: number;
  /** OPEN -> HALF_OPEN 전환 시간 (밀리초, 기본: 30000) */
  resetTimeoutMs?: number;
  /** HALF_OPEN 상태 프로브 최대 호출 수 (기본: 3) */
  halfOpenMaxCalls?: number;
  /** 실패율 계산 윈도우 (밀리초, 기본: 60000) */
  windowSizeMs?: number;
  /** 폴백 함수 (OPEN 상태 시 실행) */
  fallback?: (error: Error) => unknown;
}

/**
 * 호출 기록 엔트리
 */
interface CallRecord {
  timestamp: number;
  success: boolean;
}

/**
 * 서킷 브레이커 메트릭
 * Plan SC: FR-CB.6
 */
export interface CircuitBreakerMetrics {
  /** 서킷 이름 */
  name: string;
  /** 현재 상태 */
  state: CircuitState;
  /** 총 호출 수 */
  totalCalls: number;
  /** 성공 호출 수 */
  successCalls: number;
  /** 실패 호출 수 */
  failureCalls: number;
  /** 현재 실패율 (0~1) */
  failureRate: number;
  /** 상태 전환 횟수 */
  stateTransitions: number;
  /** 마지막 상태 변경 시각 */
  lastStateChange: string;
  /** 윈도우 내 호출 수 */
  windowCalls: number;
}

/**
 * 서킷 브레이커 오류
 */
export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`서킷 '${name}'이 OPEN 상태입니다. 요청이 차단됩니다.`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * 서킷 브레이커
 *
 * 3-상태 패턴: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 *
 * - CLOSED: 정상 동작. 실패율이 임계값 초과 시 OPEN 전환
 * - OPEN: 모든 요청 차단 (폴백 실행). resetTimeout 후 HALF_OPEN 전환
 * - HALF_OPEN: 제한된 요청 허용 (프로빙). 성공 시 CLOSED, 실패 시 OPEN
 *
 * CSAP D-14: 시스템 가용성 보장, 장애 격리
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly minimumCalls: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly windowSizeMs: number;
  private readonly fallback?: (error: Error) => unknown;

  private records: CallRecord[] = [];
  private totalCalls = 0;
  private successCalls = 0;
  private failureCalls = 0;
  private stateTransitions = 0;
  private lastStateChange: string = new Date().toISOString();
  private openedAt = 0;
  private halfOpenCallCount = 0;
  private halfOpenSuccessCount = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 0.5;
    this.minimumCalls = options.minimumCalls ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 3;
    this.windowSizeMs = options.windowSizeMs ?? 60_000;
    this.fallback = options.fallback;
  }

  /**
   * 서킷을 통해 함수 실행
   * Plan SC: FR-CB.1, FR-CB.2, FR-CB.3, FR-CB.5
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN 상태 처리
    if (this.state === 'OPEN') {
      if (this.shouldTransitionToHalfOpen()) {
        this.transitionTo('HALF_OPEN');
      } else {
        return this.handleOpen();
      }
    }

    // HALF_OPEN 상태: 프로브 호출 수 제한
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCallCount >= this.halfOpenMaxCalls) {
        return this.handleOpen();
      }
      this.halfOpenCallCount++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * 현재 서킷 상태
   */
  getState(): CircuitState {
    // OPEN 상태에서 resetTimeout 경과 시 자동 HALF_OPEN 전환
    if (this.state === 'OPEN' && this.shouldTransitionToHalfOpen()) {
      this.transitionTo('HALF_OPEN');
    }
    return this.state;
  }

  /**
   * 서킷 메트릭 반환
   * Plan SC: FR-CB.6
   */
  getMetrics(): CircuitBreakerMetrics {
    this.pruneOldRecords();

    const windowRecords = this.getWindowRecords();
    const windowFailures = windowRecords.filter((r) => !r.success).length;
    const windowTotal = windowRecords.length;

    return {
      name: this.name,
      state: this.getState(),
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      failureCalls: this.failureCalls,
      failureRate: windowTotal > 0 ? windowFailures / windowTotal : 0,
      stateTransitions: this.stateTransitions,
      lastStateChange: this.lastStateChange,
      windowCalls: windowTotal,
    };
  }

  /**
   * 서킷 수동 리셋 (운영 용도)
   */
  reset(): void {
    this.records = [];
    this.halfOpenCallCount = 0;
    this.halfOpenSuccessCount = 0;
    this.transitionTo('CLOSED');
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  private recordSuccess(): void {
    this.totalCalls++;
    this.successCalls++;
    this.records.push({ timestamp: Date.now(), success: true });
    this.pruneOldRecords();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.halfOpenMaxCalls) {
        this.transitionTo('CLOSED');
      }
    }
  }

  private recordFailure(): void {
    this.totalCalls++;
    this.failureCalls++;
    this.records.push({ timestamp: Date.now(), success: false });
    this.pruneOldRecords();

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN에서 실패 시 즉시 OPEN으로 복귀
      this.transitionTo('OPEN');
      return;
    }

    // CLOSED 상태: 실패율 확인
    if (this.state === 'CLOSED') {
      this.checkFailureThreshold();
    }
  }

  private checkFailureThreshold(): void {
    const windowRecords = this.getWindowRecords();
    if (windowRecords.length < this.minimumCalls) return;

    const failures = windowRecords.filter((r) => !r.success).length;
    const failureRate = failures / windowRecords.length;

    if (failureRate >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private shouldTransitionToHalfOpen(): boolean {
    return Date.now() - this.openedAt >= this.resetTimeoutMs;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.stateTransitions++;
    this.lastStateChange = new Date().toISOString();

    if (newState === 'OPEN') {
      this.openedAt = Date.now();
    }

    if (newState === 'HALF_OPEN') {
      this.halfOpenCallCount = 0;
      this.halfOpenSuccessCount = 0;
    }

    if (newState === 'CLOSED') {
      this.records = [];
      this.halfOpenCallCount = 0;
      this.halfOpenSuccessCount = 0;
    }
  }

  private handleOpen<T>(): T {
    const error = new CircuitOpenError(this.name);
    if (this.fallback) {
      return this.fallback(error) as T;
    }
    throw error;
  }

  private getWindowRecords(): CallRecord[] {
    const cutoff = Date.now() - this.windowSizeMs;
    return this.records.filter((r) => r.timestamp >= cutoff);
  }

  private pruneOldRecords(): void {
    const cutoff = Date.now() - this.windowSizeMs;
    this.records = this.records.filter((r) => r.timestamp >= cutoff);
  }
}
