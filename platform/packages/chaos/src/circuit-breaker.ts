// Circuit Breaker 패턴
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.2
// CSAP: D-07 가용성 -- 장애 전파 방지

/**
 * Circuit Breaker 상태
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker 설정
 */
export interface CircuitBreakerConfig {
  /** 서비스/리소스 이름 */
  name: string;
  /** 실패 임계값 (CLOSED -> OPEN) */
  failureThreshold: number;
  /** 성공 임계값 (HALF_OPEN -> CLOSED) */
  successThreshold: number;
  /** 타임아웃 (ms) -- OPEN 유지 시간 후 HALF_OPEN */
  timeoutMs: number;
  /** 요청 타임아웃 (ms) -- 개별 요청 타임아웃 */
  requestTimeoutMs?: number;
  /** Fallback 함수 */
  fallback?: () => unknown;
}

/**
 * Circuit Breaker 상태 정보
 */
export interface CircuitBreakerStatus {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit Breaker
 *
 * CSAP D-07 가용성 요건:
 * - 하위 서비스 장애 시 자동 차단 (장애 전파 방지)
 * - HALF_OPEN 상태에서 제한적 요청 허용 (자동 복구 확인)
 * - Fallback 응답으로 graceful degradation 보장
 *
 * 상태 전이:
 * CLOSED --[failureThreshold 도달]--> OPEN
 * OPEN --[timeoutMs 경과]--> HALF_OPEN
 * HALF_OPEN --[successThreshold 도달]--> CLOSED
 * HALF_OPEN --[실패]--> OPEN
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly config: Required<Pick<CircuitBreakerConfig, 'name' | 'failureThreshold' | 'successThreshold' | 'timeoutMs'>> & CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      requestTimeoutMs: 5000,
      ...config,
    };
  }

  /**
   * 현재 상태 조회
   */
  getState(): CircuitState {
    // OPEN 상태에서 타임아웃 경과 시 HALF_OPEN 전환
    if (this.state === 'OPEN' && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime >= this.config.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      }
    }
    return this.state;
  }

  /**
   * 상태 정보 조회
   */
  getStatus(): CircuitBreakerStatus {
    return {
      name: this.config.name,
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * 보호된 함수 실행
   *
   * @param fn - 실행할 비동기 함수
   * @returns 함수 실행 결과 또는 fallback
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    const currentState = this.getState();

    // OPEN 상태: 즉시 차단
    if (currentState === 'OPEN') {
      if (this.config.fallback) {
        return this.config.fallback() as T;
      }
      throw new CircuitBreakerOpenError(this.config.name);
    }

    try {
      // 요청 타임아웃 적용
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`CircuitBreaker: ${this.config.name} 요청 타임아웃 (${this.config.requestTimeoutMs}ms)`)),
            this.config.requestTimeoutMs,
          ),
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 수동 리셋 (관리 목적)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * 성공 처리
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        // HALF_OPEN -> CLOSED (복구 완료)
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === 'CLOSED') {
      // 성공 시 실패 카운터 리셋
      this.failures = 0;
    }
  }

  /**
   * 실패 처리
   */
  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // HALF_OPEN -> OPEN (복구 실패)
      this.state = 'OPEN';
      this.successes = 0;
    } else if (this.state === 'CLOSED') {
      this.failures++;
      if (this.failures >= this.config.failureThreshold) {
        // CLOSED -> OPEN (임계값 도달)
        this.state = 'OPEN';
      }
    }
  }
}

/**
 * Circuit Breaker OPEN 상태 에러
 */
export class CircuitBreakerOpenError extends Error {
  readonly circuitName: string;

  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is OPEN -- 요청 차단됨 (CSAP D-07 가용성)`);
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = circuitName;
  }
}

/**
 * Circuit Breaker 레지스트리 (다중 서비스 관리)
 */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * Circuit Breaker 등록 또는 조회
   */
  getOrCreate(config: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(config.name);
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(config.name, breaker);
    }
    return breaker;
  }

  /**
   * 전체 상태 조회
   */
  getAllStatus(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.values()).map((b) => b.getStatus());
  }

  /**
   * 특정 Circuit Breaker 리셋
   */
  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }

  /**
   * 전체 리셋
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
