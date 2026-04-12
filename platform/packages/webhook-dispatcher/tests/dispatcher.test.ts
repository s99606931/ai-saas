// Dispatcher 단위 테스트
// Design Ref: SVC-WEBHOOK-R52.design.md §3
// Plan SC: FR-WH.3, FR-WH.4, FR-WH.5, FR-WH.6

import { describe, it, expect, vi } from 'vitest';
import {
  dispatchWebhook,
  computeBackoffDelayMs,
  isRetryableStatus,
} from '../src/dispatcher.js';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '../src/signature.js';

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

describe('isRetryableStatus (FR-WH.5)', () => {
  it('5xx는 재시도 대상이다', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it('408, 429는 재시도 대상이다', () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
  });

  it('기타 4xx는 재시도 대상이 아니다', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('2xx/3xx는 재시도 대상이 아니다', () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(301)).toBe(false);
  });
});

describe('computeBackoffDelayMs (FR-WH.4)', () => {
  it('maxDelayMs 상한을 초과하지 않는다', () => {
    for (let i = 0; i < 10; i++) {
      const d = computeBackoffDelayMs(10, 1000, 5000);
      expect(d).toBeLessThanOrEqual(5000);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it('음수 attempt는 0을 반환한다', () => {
    expect(computeBackoffDelayMs(-1, 1000, 60000)).toBe(0);
  });
});

describe('dispatchWebhook (FR-WH.3)', () => {
  const baseOptions = {
    secret: 'test-secret',
    baseDelayMs: 1, // 테스트 가속
    maxDelayMs: 5,
    timeoutMs: 5000,
    sleepImpl: async () => {},
  };

  it('2xx 응답 시 1회 시도로 성공한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200));
    const result = await dispatchWebhook('https://example.gov.kr/hook', { event: 'x' }, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.lastStatus).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('5xx → 5xx → 200 순으로 재시도 후 성공한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(502))
      .mockResolvedValueOnce(mockResponse(204));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.lastStatus).toBe(204);
  });

  it('maxAttempts를 초과하면 실패 반환한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(500));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      maxAttempts: 3,
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.lastStatus).toBe(500);
    expect(result.lastError).toBe('HTTP 500');
  });

  it('400은 즉시 중단한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(400));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.lastStatus).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('429는 재시도 대상이다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(429))
      .mockResolvedValueOnce(mockResponse(200));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('408은 재시도 대상이다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(408))
      .mockResolvedValueOnce(mockResponse(200));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('네트워크 예외는 재시도한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(mockResponse(200));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('X-Public-SaaS-Signature 헤더를 포함한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200));
    await dispatchWebhook('https://example.gov.kr/hook', { a: 1 }, {
      ...baseOptions,
      fetchImpl,
    });
    const call = fetchImpl.mock.calls[0];
    const headers = (call[1] as { headers: Record<string, string> }).headers;
    expect(headers[SIGNATURE_HEADER]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(headers[TIMESTAMP_HEADER]).toMatch(/^\d+$/);
  });

  it('extra headers를 병합한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200));
    await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
      headers: { 'x-tenant-id': 'gov-001' },
    });
    const headers = (fetchImpl.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers['x-tenant-id']).toBe('gov-001');
    expect(headers['content-type']).toBe('application/json');
  });

  it('durationMs를 음이 아닌 값으로 반환한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200));
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('secret이 없으면 예외를 throw한다', async () => {
    await expect(
      dispatchWebhook('https://x', {}, { secret: '' } as unknown as typeof baseOptions),
    ).rejects.toThrow('secret must be provided');
  });

  it('외부 abort 시그널이 aborted되면 반복을 중단한다', async () => {
    const controller = new AbortController();
    const fetchImpl = vi
      .fn()
      .mockImplementation(async () => {
        controller.abort();
        return mockResponse(500);
      });
    const result = await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
      signal: controller.signal,
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it('각 시도마다 새 timestamp로 서명한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(200));
    let counter = 1_700_000_000;
    await dispatchWebhook('https://example.gov.kr/hook', {}, {
      ...baseOptions,
      fetchImpl,
      now: () => counter++,
    });
    const h1 = (fetchImpl.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    const h2 = (fetchImpl.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(h1[TIMESTAMP_HEADER]).not.toBe(h2[TIMESTAMP_HEADER]);
  });
});
