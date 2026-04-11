// 지수 백오프 재시도
// Design Ref: SVC-CIRCUIT-R25 DESIGN §2
// Plan SC: FR-CB.4
// CSAP: D-14 시스템 가용성

/**
 * 재시도 옵션
 */
export interface RetryOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 기본 대기 시간 밀리초 (기본: 1000) */
  baseDelayMs?: number;
  /** 최대 대기 시간 밀리초 (기본: 30000) */
  maxDelayMs?: number;
  /** 지터 활성화 (기본: true) */
  jitterEnabled?: boolean;
  /** 재시도 대상 에러 판별 함수 (기본: 모든 에러 재시도) */
  retryableErrors?: (error: Error) => boolean;
  /** 재시도 시 콜백 (로깅/메트릭용) */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * 재시도 결과
 */
export interface RetryResult<T> {
  /** 실행 결과 */
  result: T;
  /** 총 시도 횟수 (1 = 첫 시도 성공) */
  attempts: number;
  /** 총 대기 시간 (밀리초) */
  totalDelayMs: number;
}

/**
 * 지수 백오프 대기 시간 계산
 * Plan SC: FR-CB.4
 *
 * delay = baseDelay * 2^(attempt-1) + jitter
 * jitter = random(0, baseDelay * 0.1)
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterEnabled: boolean,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = jitterEnabled ? Math.random() * baseDelayMs * 0.1 : 0;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * 지수 백오프 재시도
 * Plan SC: FR-CB.4
 *
 * 실패한 비동기 작업을 지수적으로 증가하는 대기 시간과 함께 재시도합니다.
 * 지터(jitter)를 추가하여 thundering herd 문제를 방지합니다.
 *
 * @param fn 실행할 비동기 함수
 * @param options 재시도 옵션
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitterEnabled = true,
    retryableErrors,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt, totalDelayMs };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 마지막 시도이면 재시도 불가
      if (attempt > maxRetries) break;

      // 재시도 불가능한 에러 확인
      if (retryableErrors && !retryableErrors(lastError)) break;

      // 대기 시간 계산
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterEnabled);
      totalDelayMs += delayMs;

      // 콜백 실행
      if (onRetry) {
        onRetry(attempt, lastError, delayMs);
      }

      // 대기
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * 간편 재시도 데코레이터 (함수 래핑)
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): () => Promise<T> {
  return async () => {
    const { result } = await retryWithBackoff(fn, options);
    return result;
  };
}
