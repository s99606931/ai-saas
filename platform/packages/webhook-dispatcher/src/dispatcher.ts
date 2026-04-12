// Webhook 발송기 (지수 백오프 재시도 + HMAC 서명)
// Design Ref: SVC-WEBHOOK-R52.design.md §3
// Plan SC: FR-WH.3, FR-WH.4, FR-WH.5, FR-WH.6
// CSAP: D-06 감사, D-14 가용성

import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signPayload,
} from './signature.js';
import type { DispatchOptions, DispatchResult } from './types.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;

/** 4xx 중 재시도 가능한 상태 */
const RETRYABLE_4XX = new Set([408, 429]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 지수 백오프 + full jitter 지연 계산
 * Plan SC: FR-WH.4
 */
export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  if (attempt < 0) return 0;
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  // full jitter: 0 ~ capped
  return Math.floor(Math.random() * capped);
}

/**
 * 상태 코드 기반 재시도 분류
 * Plan SC: FR-WH.5
 */
export function isRetryableStatus(status: number): boolean {
  if (status >= 500) return true;
  if (RETRYABLE_4XX.has(status)) return true;
  return false;
}

/**
 * Webhook 페이로드를 HMAC-SHA256 서명과 함께 POST로 발송한다.
 * 실패 시 지수 백오프로 재시도한다.
 * Plan SC: FR-WH.3, FR-WH.4, FR-WH.5, FR-WH.6
 *
 * @param url - 대상 URL
 * @param payload - 전송할 객체 (JSON 직렬화)
 * @param options - 발송 옵션
 * @returns 발송 결과
 */
export async function dispatchWebhook(
  url: string,
  payload: unknown,
  options: DispatchOptions,
): Promise<DispatchResult> {
  if (!options.secret) {
    throw new Error('secret must be provided');
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? defaultSleep;
  const now = options.now;
  const extraHeaders = options.headers ?? {};

  const startedAt = Date.now();
  const body = JSON.stringify(payload);

  let attempts = 0;
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;

    // 각 시도마다 새 서명/타임스탬프 생성 (replay 방지)
    const ts = now ? now() : Math.floor(Date.now() / 1000);
    const { signature, timestamp } = signPayload(body, options.secret, ts);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      [SIGNATURE_HEADER]: signature,
      [TIMESTAMP_HEADER]: String(timestamp),
      ...extraHeaders,
    };

    try {
      // AbortSignal 구성: timeoutMs + 외부 signal 병합
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = options.signal
        ? AbortSignal.any([timeoutSignal, options.signal])
        : timeoutSignal;

      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal,
      });

      lastStatus = response.status;

      if (response.ok) {
        return {
          success: true,
          attempts,
          lastStatus,
          durationMs: Date.now() - startedAt,
        };
      }

      if (!isRetryableStatus(response.status)) {
        return {
          success: false,
          attempts,
          lastStatus,
          lastError: `HTTP ${response.status}`,
          durationMs: Date.now() - startedAt,
        };
      }

      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatus = undefined;

      // AbortError/타임아웃도 재시도 대상
    }

    // 외부 abort가 트리거되었는지 확인
    if (options.signal?.aborted) {
      return {
        success: false,
        attempts,
        lastStatus,
        lastError: lastError ?? 'aborted',
        durationMs: Date.now() - startedAt,
      };
    }

    if (attempts >= maxAttempts) break;

    const delayMs = computeBackoffDelayMs(attempts - 1, baseDelay, maxDelay);
    await sleep(delayMs);
  }

  return {
    success: false,
    attempts,
    lastStatus,
    lastError,
    durationMs: Date.now() - startedAt,
  };
}
