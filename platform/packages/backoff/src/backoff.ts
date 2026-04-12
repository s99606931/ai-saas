// Exponential Backoff -- 지수 백오프 + jitter
// Design Ref: SVC-BACKOFF-R42 DESIGN
// Plan SC: FR-BO.1~FR-BO.6
// CSAP: D-14 가용성

export type JitterStrategy = 'none' | 'full' | 'equal' | 'decorrelated';

export interface BackoffOptions {
  /** 최초 지연 (ms) */
  baseMs: number;
  /** 지수 배수 (기본 2) */
  factor?: number;
  /** 최대 지연 (ms) */
  maxDelayMs: number;
  /** 최대 재시도 횟수 */
  maxAttempts: number;
  /** Jitter 전략 */
  jitter?: JitterStrategy;
}

/**
 * 지수 백오프 대기 시간 계산
 * Plan SC: FR-BO.1, FR-BO.2, FR-BO.3
 */
export function calculateDelay(
  attempt: number,
  options: BackoffOptions,
  previousDelay = 0,
): number {
  if (attempt < 0) {
    throw new Error('attempt는 0 이상이어야 합니다.');
  }
  const factor = options.factor ?? 2;
  const exponential = options.baseMs * Math.pow(factor, attempt);
  const capped = Math.min(exponential, options.maxDelayMs);
  return applyJitter(capped, options.jitter ?? 'full', previousDelay, options);
}

function applyJitter(
  delay: number,
  strategy: JitterStrategy,
  previousDelay: number,
  options: BackoffOptions,
): number {
  switch (strategy) {
    case 'none':
      return delay;
    case 'full':
      return Math.random() * delay;
    case 'equal':
      return delay / 2 + Math.random() * (delay / 2);
    case 'decorrelated': {
      const base = options.baseMs;
      const cap = options.maxDelayMs;
      const randomized = base + Math.random() * (previousDelay * 3 - base);
      return Math.min(cap, Math.max(base, randomized));
    }
    default:
      return delay;
  }
}

export interface RetryContext {
  attempt: number;
  error: unknown;
  nextDelayMs: number;
}

export interface RetryOptions extends BackoffOptions {
  /** 재시도 가능 여부 판단. 기본: 모든 에러 재시도 */
  isRetryable?: (error: unknown) => boolean;
  /** 재시도 전 콜백 */
  onRetry?: (ctx: RetryContext) => void;
  /** 취소 시그널 */
  signal?: AbortSignal;
}

export class RetryAbortedError extends Error {
  readonly code = 'RETRY_ABORTED';
}

export class RetryExhaustedError extends Error {
  readonly code = 'RETRY_EXHAUSTED';
  constructor(
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`${attempts}회 재시도 후 실패`);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * 재시도 실행기
 * Plan SC: FR-BO.4, FR-BO.5, FR-BO.6
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (options.maxAttempts < 1) {
    throw new Error('maxAttempts는 1 이상이어야 합니다.');
  }

  let lastError: unknown;
  let previousDelay = options.baseMs;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw new RetryAbortedError('재시도가 취소되었습니다.');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 재시도 가능 여부 확인
      if (options.isRetryable && !options.isRetryable(error)) {
        throw error;
      }

      // 마지막 시도 → 재시도 안 함
      if (attempt === options.maxAttempts - 1) {
        break;
      }

      const delay = calculateDelay(attempt, options, previousDelay);
      previousDelay = delay;

      if (options.onRetry) {
        options.onRetry({
          attempt: attempt + 1,
          error,
          nextDelayMs: delay,
        });
      }

      await sleep(delay, options.signal);
    }
  }

  throw new RetryExhaustedError(options.maxAttempts, lastError);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryAbortedError('재시도가 취소되었습니다.'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new RetryAbortedError('재시도가 취소되었습니다.'));
    };

    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * 일반적인 HTTP 재시도 가능 에러 판단기
 */
export function isTransientHttpError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: number; statusCode?: number }).status
    ?? (error as { statusCode?: number }).statusCode;
  if (typeof status !== 'number') return false;
  return status >= 500 || status === 408 || status === 429;
}
