// 복원력 테스트 실행기
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.3
// CSAP: D-07 가용성

import { ChaosEngine, type FaultConfig } from './chaos-engine.js';
import { CircuitBreaker, type CircuitBreakerConfig, CircuitBreakerOpenError } from './circuit-breaker.js';

/**
 * 복원력 테스트 시나리오
 */
export interface ResilienceScenario {
  /** 시나리오 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** 장애 설정 */
  faultConfig: FaultConfig;
  /** 테스트 함수 */
  test: (ctx: {
    chaos: ChaosEngine;
    breaker: CircuitBreaker;
  }) => Promise<ResilienceResult>;
}

/**
 * 복원력 테스트 결과
 */
export interface ResilienceResult {
  passed: boolean;
  scenario: string;
  message: string;
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    circuitBreakerTriggered: boolean;
    recoveryTimeMs?: number;
  };
}

/**
 * 복원력 테스트 실행기
 *
 * 사전 정의된 시나리오로 서비스 복원력을 검증
 */
export class ResilienceTestRunner {
  private readonly chaos: ChaosEngine;
  private readonly results: ResilienceResult[] = [];

  constructor() {
    this.chaos = new ChaosEngine();
  }

  /**
   * 단일 시나리오 실행
   */
  async runScenario(scenario: ResilienceScenario): Promise<ResilienceResult> {
    // 장애 주입
    const faultId = this.chaos.injectFault(scenario.faultConfig);

    const breaker = new CircuitBreaker({
      name: `test-${scenario.name}`,
      failureThreshold: 5,
      successThreshold: 3,
      timeoutMs: 1000,
    });

    try {
      const result = await scenario.test({ chaos: this.chaos, breaker });
      this.results.push(result);
      return result;
    } finally {
      // 장애 해제
      this.chaos.removeFault(faultId);
    }
  }

  /**
   * 전체 결과 조회
   */
  getResults(): ResilienceResult[] {
    return [...this.results];
  }

  /**
   * 전체 통과 여부
   */
  allPassed(): boolean {
    return this.results.every((r) => r.passed);
  }

  /**
   * 결과 초기화
   */
  clearResults(): void {
    this.results.length = 0;
  }
}

/**
 * 사전 정의된 복원력 시나리오 팩토리
 */
export const ResilienceScenarios = {
  /**
   * 시나리오 1: DB 연결 실패 시 서비스 격리 확인
   */
  dbConnectionFailure(serviceFn: () => Promise<unknown>): ResilienceScenario {
    return {
      name: 'db-connection-failure',
      description: 'DB 연결 실패 시 서비스 격리 확인',
      faultConfig: {
        type: 'connection_failure',
        probability: 1.0,
        targetPattern: '.*',
      },
      test: async ({ breaker }) => {
        let failures = 0;
        let circuitTriggered = false;

        for (let i = 0; i < 10; i++) {
          try {
            await breaker.execute(serviceFn);
          } catch (error) {
            failures++;
            if (error instanceof CircuitBreakerOpenError) {
              circuitTriggered = true;
            }
          }
        }

        return {
          passed: circuitTriggered && failures > 0,
          scenario: 'db-connection-failure',
          message: circuitTriggered
            ? 'Circuit breaker가 정상적으로 작동하여 장애가 격리됨'
            : 'Circuit breaker가 작동하지 않음',
          metrics: {
            totalRequests: 10,
            successfulRequests: 10 - failures,
            failedRequests: failures,
            circuitBreakerTriggered: circuitTriggered,
          },
        };
      },
    };
  },

  /**
   * 시나리오 2: 하위 서비스 타임아웃 시 Circuit Breaker 작동
   */
  serviceTimeout(timeoutMs: number = 100): ResilienceScenario {
    return {
      name: 'service-timeout',
      description: '하위 서비스 타임아웃 시 Circuit Breaker 작동',
      faultConfig: {
        type: 'latency',
        probability: 1.0,
        delayMs: timeoutMs * 10, // 의도적으로 타임아웃보다 긴 지연
      },
      test: async ({ breaker }) => {
        // 짧은 타임아웃의 Circuit Breaker 생성
        const shortBreaker = new CircuitBreaker({
          name: 'timeout-test',
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 500,
          requestTimeoutMs: timeoutMs,
        });

        let failures = 0;
        let circuitTriggered = false;

        for (let i = 0; i < 8; i++) {
          try {
            await shortBreaker.execute(async () => {
              await new Promise((resolve) => setTimeout(resolve, timeoutMs * 10));
              return 'ok';
            });
          } catch (error) {
            failures++;
            if (error instanceof CircuitBreakerOpenError) {
              circuitTriggered = true;
            }
          }
        }

        return {
          passed: circuitTriggered,
          scenario: 'service-timeout',
          message: circuitTriggered
            ? 'Circuit breaker가 타임아웃에 정상 반응하여 OPEN 전환됨'
            : 'Circuit breaker가 타임아웃에 반응하지 않음',
          metrics: {
            totalRequests: 8,
            successfulRequests: 8 - failures,
            failedRequests: failures,
            circuitBreakerTriggered: circuitTriggered,
          },
        };
      },
    };
  },

  /**
   * 시나리오 3: 에러율 급증 후 자동 복구
   */
  errorSpikeAndRecovery(): ResilienceScenario {
    return {
      name: 'error-spike-recovery',
      description: '에러율 급증 후 Circuit Breaker 자동 복구 확인',
      faultConfig: {
        type: 'error',
        probability: 1.0,
        errorCode: 500,
        errorMessage: '시뮬레이션 에러',
      },
      test: async () => {
        const breaker = new CircuitBreaker({
          name: 'recovery-test',
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 100, // 빠른 복구 테스트를 위해 짧은 타임아웃
        });

        let requestCount = 0;
        let errorPhaseFailures = 0;

        // Phase 1: 에러 주입 (CLOSED -> OPEN)
        for (let i = 0; i < 5; i++) {
          requestCount++;
          try {
            await breaker.execute(async () => {
              throw new Error('서비스 에러');
            });
          } catch {
            errorPhaseFailures++;
          }
        }

        const stateAfterErrors = breaker.getState();

        // Phase 2: 대기 (OPEN -> HALF_OPEN)
        await new Promise((resolve) => setTimeout(resolve, 150));
        const stateAfterTimeout = breaker.getState();

        // Phase 3: 성공 요청 (HALF_OPEN -> CLOSED)
        let recoverySuccesses = 0;
        for (let i = 0; i < 3; i++) {
          requestCount++;
          try {
            await breaker.execute(async () => 'success');
            recoverySuccesses++;
          } catch {
            // HALF_OPEN 상태에서 실패할 수 있음
          }
        }

        const stateAfterRecovery = breaker.getState();

        const passed =
          stateAfterErrors === 'OPEN' &&
          stateAfterTimeout === 'HALF_OPEN' &&
          stateAfterRecovery === 'CLOSED';

        return {
          passed,
          scenario: 'error-spike-recovery',
          message: passed
            ? `정상 복구: OPEN(에러 후) -> HALF_OPEN(타임아웃 후) -> CLOSED(성공 후)`
            : `비정상: ${stateAfterErrors} -> ${stateAfterTimeout} -> ${stateAfterRecovery}`,
          metrics: {
            totalRequests: requestCount,
            successfulRequests: recoverySuccesses,
            failedRequests: errorPhaseFailures,
            circuitBreakerTriggered: stateAfterErrors === 'OPEN',
            recoveryTimeMs: 150,
          },
        };
      },
    };
  },
};
