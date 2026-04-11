// 재시도 테스트
// Design Ref: SVC-CIRCUIT-R25 DESIGN §2
// Plan SC: FR-CB.4

import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, withRetry } from '../src/retry.js';

describe('retryWithBackoff', () => {
  describe('FR-CB.4: 지수 백오프 재시도', () => {
    it('첫 시도 성공 시 재시도 없음', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await retryWithBackoff(fn);

      expect(result.result).toBe('ok');
      expect(result.attempts).toBe(1);
      expect(result.totalDelayMs).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('첫 실패 후 재시도 성공', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('first-fail');
        return 'ok';
      });

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        jitterEnabled: false,
      });

      expect(result.result).toBe('ok');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('최대 재시도 초과 시 마지막 에러 throw', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always-fail'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10, jitterEnabled: false }),
      ).rejects.toThrow('always-fail');

      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('지수 백오프 대기 시간이 증가한다', async () => {
      const delays: number[] = [];
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelayMs: 100,
          jitterEnabled: false,
          onRetry: (_attempt, _error, delayMs) => {
            delays.push(delayMs);
          },
        });
      } catch { /* expected */ }

      // 지수 백오프: 100, 200, 400
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });

    it('maxDelayMs를 초과하지 않는다', async () => {
      const delays: number[] = [];
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryWithBackoff(fn, {
          maxRetries: 5,
          baseDelayMs: 100,
          maxDelayMs: 300,
          jitterEnabled: false,
          onRetry: (_attempt, _error, delayMs) => {
            delays.push(delayMs);
          },
        });
      } catch { /* expected */ }

      // 300ms 초과하지 않음
      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(300);
      }
    });

    it('retryableErrors로 재시도 대상 에러를 필터링한다', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('non-retryable');
        return 'ok';
      });

      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelayMs: 10,
          retryableErrors: (err) => err.message !== 'non-retryable',
        }),
      ).rejects.toThrow('non-retryable');

      expect(fn).toHaveBeenCalledTimes(1); // 재시도 없이 즉시 중단
    });

    it('onRetry 콜백이 호출된다', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryWithBackoff(fn, {
          maxRetries: 2,
          baseDelayMs: 10,
          jitterEnabled: false,
          onRetry,
        });
      } catch { /* expected */ }

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10);
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), 20);
    });
  });

  describe('withRetry', () => {
    it('래핑된 함수를 재시도한다', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 3) throw new Error('fail');
        return 'ok';
      };

      const retryableFn = withRetry(fn, { maxRetries: 3, baseDelayMs: 10, jitterEnabled: false });
      const result = await retryableFn();
      expect(result).toBe('ok');
    });
  });
});
