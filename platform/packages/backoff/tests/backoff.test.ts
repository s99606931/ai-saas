// Backoff 테스트
// Plan SC: FR-BO.1~FR-BO.6

import { describe, it, expect } from 'vitest';
import {
  calculateDelay,
  executeWithRetry,
  isTransientHttpError,
  RetryExhaustedError,
  RetryAbortedError,
} from '../src/backoff.js';

describe('FR-BO.1: 지수 백오프', () => {
  it('attempt에 따라 지수 증가', () => {
    const opts = {
      baseMs: 100,
      factor: 2,
      maxDelayMs: 10_000,
      maxAttempts: 5,
      jitter: 'none' as const,
    };
    expect(calculateDelay(0, opts)).toBe(100);
    expect(calculateDelay(1, opts)).toBe(200);
    expect(calculateDelay(2, opts)).toBe(400);
    expect(calculateDelay(3, opts)).toBe(800);
  });
});

describe('FR-BO.2: Jitter 전략', () => {
  const opts = {
    baseMs: 100,
    maxDelayMs: 10_000,
    maxAttempts: 3,
  };

  it('none: 정확한 delay', () => {
    const delay = calculateDelay(2, { ...opts, jitter: 'none' });
    expect(delay).toBe(400);
  });

  it('full: [0, delay] 범위', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(2, { ...opts, jitter: 'full' });
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(400);
    }
  });

  it('equal: [delay/2, delay] 범위', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(2, { ...opts, jitter: 'equal' });
      expect(delay).toBeGreaterThanOrEqual(200);
      expect(delay).toBeLessThanOrEqual(400);
    }
  });

  it('decorrelated: base와 prev*3 사이', () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(2, { ...opts, jitter: 'decorrelated' }, 300);
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(900);
    }
  });
});

describe('FR-BO.3: maxDelay 상한', () => {
  it('지수가 상한 초과 시 capped', () => {
    const opts = {
      baseMs: 100,
      factor: 2,
      maxDelayMs: 500,
      maxAttempts: 10,
      jitter: 'none' as const,
    };
    expect(calculateDelay(5, opts)).toBe(500);
    expect(calculateDelay(10, opts)).toBe(500);
  });
});

describe('FR-BO.4: executeWithRetry', () => {
  it('성공 시 결과 반환', async () => {
    const result = await executeWithRetry(async () => 'ok', {
      baseMs: 1,
      maxDelayMs: 10,
      maxAttempts: 3,
      jitter: 'none',
    });
    expect(result).toBe('ok');
  });

  it('실패 후 재시도', async () => {
    let attempts = 0;
    const result = await executeWithRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('일시 실패');
        return 'success';
      },
      {
        baseMs: 1,
        maxDelayMs: 5,
        maxAttempts: 5,
        jitter: 'none',
      },
    );
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('maxAttempts 초과 시 RetryExhaustedError', async () => {
    let attempts = 0;
    await expect(
      executeWithRetry(
        async () => {
          attempts++;
          throw new Error('계속 실패');
        },
        { baseMs: 1, maxDelayMs: 5, maxAttempts: 3, jitter: 'none' },
      ),
    ).rejects.toThrow(RetryExhaustedError);
    expect(attempts).toBe(3);
  });
});

describe('FR-BO.5: isRetryable', () => {
  it('재시도 불가 에러는 즉시 throw', async () => {
    let attempts = 0;
    await expect(
      executeWithRetry(
        async () => {
          attempts++;
          const err = new Error('400 Bad Request') as Error & { status: number };
          err.status = 400;
          throw err;
        },
        {
          baseMs: 1,
          maxDelayMs: 5,
          maxAttempts: 5,
          jitter: 'none',
          isRetryable: isTransientHttpError,
        },
      ),
    ).rejects.toThrow('400 Bad Request');
    expect(attempts).toBe(1);
  });

  it('transient HTTP 에러는 재시도', async () => {
    let attempts = 0;
    await expect(
      executeWithRetry(
        async () => {
          attempts++;
          const err = new Error('503 Service Unavailable') as Error & { status: number };
          err.status = 503;
          throw err;
        },
        {
          baseMs: 1,
          maxDelayMs: 5,
          maxAttempts: 3,
          jitter: 'none',
          isRetryable: isTransientHttpError,
        },
      ),
    ).rejects.toThrow(RetryExhaustedError);
    expect(attempts).toBe(3);
  });
});

describe('FR-BO.6: 취소 시그널', () => {
  it('abort 시 RetryAbortedError', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    await expect(
      executeWithRetry(
        async () => {
          throw new Error('fail');
        },
        {
          baseMs: 50,
          maxDelayMs: 100,
          maxAttempts: 10,
          jitter: 'none',
          signal: controller.signal,
        },
      ),
    ).rejects.toThrow(RetryAbortedError);
  });
});

describe('isTransientHttpError', () => {
  it('5xx는 transient', () => {
    expect(isTransientHttpError({ status: 500 })).toBe(true);
    expect(isTransientHttpError({ status: 503 })).toBe(true);
  });

  it('408, 429는 transient', () => {
    expect(isTransientHttpError({ status: 408 })).toBe(true);
    expect(isTransientHttpError({ status: 429 })).toBe(true);
  });

  it('4xx (408, 429 제외)는 non-transient', () => {
    expect(isTransientHttpError({ status: 400 })).toBe(false);
    expect(isTransientHttpError({ status: 404 })).toBe(false);
  });

  it('statusCode 필드도 인식', () => {
    expect(isTransientHttpError({ statusCode: 502 })).toBe(true);
  });
});
