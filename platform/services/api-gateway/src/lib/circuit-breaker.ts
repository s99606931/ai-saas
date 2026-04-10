// Circuit Breaker — 서비스 간 장애 전파 방지
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.9 (운영 안정성 보완)
// CSAP: D-07 가용성 — 장애 격리

/**
 * Circuit Breaker 상태
 *
 * CLOSED:    정상 — 요청 통과
 * OPEN:      차단 — 즉시 실패 반환 (서비스 보호)
 * HALF_OPEN: 시험 — 일부 요청만 허용하여 복구 확인
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** 실패 허용 횟수 (이 횟수 초과 시 OPEN) */
  failureThreshold: number;
  /** OPEN 유지 시간 (ms) — 이후 HALF_OPEN 전환 */
  resetTimeout: number;
  /** 요청 타임아웃 (ms) */
  requestTimeout: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30초
  requestTimeout: 10000, // 10초
};

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

/**
 * 서비스별 Circuit Breaker 관리
 *
 * 사용법:
 *   const result = await circuitBreaker.execute('auth-service', () => fetch(url));
 */
class CircuitBreakerManager {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getCircuit(serviceId: string): CircuitBreakerState {
    let circuit = this.circuits.get(serviceId);
    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0,
      };
      this.circuits.set(serviceId, circuit);
    }
    return circuit;
  }

  /**
   * Circuit Breaker를 통해 요청 실행
   *
   * @param serviceId - 서비스 식별자
   * @param action - 실행할 비동기 함수
   * @returns 실행 결과
   * @throws CircuitOpenError (OPEN 상태), 원래 에러 (실행 실패)
   */
  async execute<T>(serviceId: string, action: () => Promise<T>): Promise<T> {
    const circuit = this.getCircuit(serviceId);

    // OPEN 상태 확인
    if (circuit.state === 'OPEN') {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.options.resetTimeout) {
        // HALF_OPEN 전환
        circuit.state = 'HALF_OPEN';
        circuit.successCount = 0;
      } else {
        throw new CircuitOpenError(serviceId, this.options.resetTimeout - elapsed);
      }
    }

    // 타임아웃 래핑
    try {
      const result = await this.withTimeout(action(), this.options.requestTimeout);
      this.onSuccess(circuit);
      return result;
    } catch (error) {
      this.onFailure(circuit);
      throw error;
    }
  }

  private onSuccess(circuit: CircuitBreakerState): void {
    if (circuit.state === 'HALF_OPEN') {
      circuit.successCount += 1;
      // HALF_OPEN에서 2회 연속 성공 시 CLOSED 복귀
      if (circuit.successCount >= 2) {
        circuit.state = 'CLOSED';
        circuit.failureCount = 0;
      }
    } else {
      circuit.failureCount = 0;
    }
  }

  private onFailure(circuit: CircuitBreakerState): void {
    circuit.failureCount += 1;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // HALF_OPEN에서 실패 → 다시 OPEN
      circuit.state = 'OPEN';
    } else if (circuit.failureCount >= this.options.failureThreshold) {
      circuit.state = 'OPEN';
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`요청 타임아웃 (${timeoutMs}ms)`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 서비스 상태 조회 (모니터링용)
   */
  getStatus(serviceId: string): CircuitBreakerState & { serviceId: string } {
    const circuit = this.getCircuit(serviceId);
    return { serviceId, ...circuit };
  }

  /**
   * 전체 서비스 상태 조회
   */
  getAllStatus(): Array<CircuitBreakerState & { serviceId: string }> {
    const result: Array<CircuitBreakerState & { serviceId: string }> = [];
    for (const [serviceId, circuit] of this.circuits) {
      result.push({ serviceId, ...circuit });
    }
    return result;
  }

  /**
   * 수동 리셋 (운영 도구용)
   */
  reset(serviceId: string): void {
    this.circuits.delete(serviceId);
  }
}

/**
 * Circuit Breaker OPEN 상태 에러
 */
export class CircuitOpenError extends Error {
  public readonly serviceId: string;
  public readonly retryAfterMs: number;

  constructor(serviceId: string, retryAfterMs: number) {
    super(
      `Circuit breaker OPEN: 서비스 '${serviceId}'가 일시적으로 차단되었습니다. ${Math.ceil(retryAfterMs / 1000)}초 후 재시도하세요.`,
    );
    this.name = 'CircuitOpenError';
    this.serviceId = serviceId;
    this.retryAfterMs = retryAfterMs;
  }
}

/** 싱글턴 인스턴스 */
export const circuitBreaker = new CircuitBreakerManager({
  failureThreshold: 5,
  resetTimeout: 30000, // 30초
  requestTimeout: 10000, // 10초
});

export { CircuitBreakerManager };
export type { CircuitBreakerOptions, CircuitBreakerState, CircuitState };
