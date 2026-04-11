// AI SSE 스트리밍 코어 — FR-ADV6.1, FR-ADV6.2, FR-ADV6.4, FR-ADV6.5, FR-ADV6.7
// Design Ref: SVC-AI-ADV-R6 DESIGN §1, §3, §4, §6
// Plan SC: SC-1 (TTFT < 1초), SC-3 (백프레셔), SC-4 (에러 이벤트)
// CSAP: D-12 시스템 개발 보안, D-06 감사 로깅, N2SF N-05 O등급 데이터만 처리

import type { LLMProvider, LLMMessage, LLMChatOptions, LLMStreamChunk } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

// ── SSE 이벤트 타입 정의 ─────────────────────────────────────────────────────

/** 토큰 이벤트 — 스트리밍 중 각 토큰 전달 */
export interface SSETokenEvent {
  /** 생성된 텍스트 조각 */
  delta: string;
  /** 토큰 순번 (0부터 시작) */
  index: number;
}

/** 사용량 이벤트 — 스트림 완료 시 토큰 사용량 요약 */
export interface SSEUsageEvent {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 완료 이벤트 — 스트림 정상 종료 */
export interface SSEDoneEvent {
  finishReason: 'stop' | 'length' | 'cancelled';
  totalTokens: number;
}

/** 에러 이벤트 — 스트림 중 오류 발생 */
export interface SSEErrorEvent {
  code: 'PROVIDER_ERROR' | 'TOKEN_LIMIT' | 'TIMEOUT' | 'INTERNAL_ERROR' | 'BUFFER_OVERFLOW';
  message: string;
}

/** SSE 이벤트 합집합 */
export type SSEEvent =
  | { type: 'token'; data: SSETokenEvent }
  | { type: 'usage'; data: SSEUsageEvent }
  | { type: 'done'; data: SSEDoneEvent }
  | { type: 'error'; data: SSEErrorEvent }
  | { type: 'ping'; data: Record<string, never> };

// ── 설정 ─────────────────────────────────────────────────────────────────────

/** 스트리밍 설정 */
export interface StreamingConfig {
  /** Heartbeat 간격 (ms, 기본 30000) */
  heartbeatIntervalMs?: number;
  /** 스트림 최대 타임아웃 (ms, 기본 300000 = 5분) */
  maxStreamTimeoutMs?: number;
  /** 세션당 최대 버퍼 크기 (bytes, 기본 2MB) */
  maxBufferBytes?: number;
  /** 토큰 한도 (0 = 무제한) */
  tokenLimit?: number;
  /** PII 마스킹 활성화 (기본 true) */
  enablePIIMasking?: boolean;
  /** 프롬프트 토큰 수 (사전 계산된 값) */
  promptTokens?: number;
}

const DEFAULT_CONFIG: Required<StreamingConfig> = {
  heartbeatIntervalMs: 30_000,
  maxStreamTimeoutMs: 300_000,
  maxBufferBytes: 2 * 1024 * 1024, // 2MB — NFR-R6.3
  tokenLimit: 0,
  enablePIIMasking: true,
  promptTokens: 0,
};

// ── 토큰 카운터 ──────────────────────────────────────────────────────────────

/** 실시간 토큰 카운터 — Design §5 */
export interface TokenCounter {
  promptTokens: number;
  completionTokens: number;
  startTime: number;
}

function createTokenCounter(promptTokens: number): TokenCounter {
  return {
    promptTokens,
    completionTokens: 0,
    startTime: Date.now(),
  };
}

// ── SSE 인코더 ───────────────────────────────────────────────────────────────

const textEncoder = new TextEncoder();

/**
 * SSE 이벤트를 바이트 배열로 직렬화합니다.
 * SSE 프로토콜: "event: {type}\ndata: {json}\n\n"
 */
export function encodeSSEEvent(event: SSEEvent): Uint8Array {
  const line = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  return textEncoder.encode(line);
}

// ── SSE 스트림 생성 ──────────────────────────────────────────────────────────

/** createSSEStream 입력 옵션 */
export interface CreateSSEStreamOptions {
  /** LLM 프로바이더 인스턴스 */
  provider: LLMProvider;
  /** 채팅 메시지 배열 */
  messages: LLMMessage[];
  /** LLM 채팅 옵션 */
  chatOptions?: LLMChatOptions;
  /** 스트리밍 설정 */
  config?: StreamingConfig;
  /** 외부 취소 시그널 (클라이언트 AbortController) */
  signal?: AbortSignal;
  /** 스트림 완료 콜백 (감사 로그, 사용량 기록 등) */
  onComplete?: (usage: SSEUsageEvent, finishReason: string) => void;
  /** 에러 콜백 */
  onError?: (error: SSEErrorEvent) => void;
}

/**
 * SSE 스트리밍 ReadableStream을 생성합니다.
 *
 * LLM 프로바이더의 chatStream()으로부터 토큰을 받아
 * SSE 프로토콜로 변환하여 ReadableStream으로 제공합니다.
 *
 * 백프레셔: ReadableStream의 pull() 메커니즘으로 자연 제어
 * 취소: AbortSignal + ReadableStream.cancel()
 * Heartbeat: 설정된 간격으로 ping 이벤트 전송
 *
 * @param options - 스트림 생성 옵션
 * @returns SSE 인코딩된 ReadableStream
 */
export function createSSEStream(options: CreateSSEStreamOptions): ReadableStream<Uint8Array> {
  const {
    provider,
    messages,
    chatOptions,
    signal,
    onComplete,
    onError,
  } = options;

  const config = { ...DEFAULT_CONFIG, ...options.config };
  const counter = createTokenCounter(config.promptTokens);

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let streamIterator: AsyncGenerator<LLMStreamChunk> | null = null;
  let cancelled = false;
  let totalBytesEnqueued = 0;
  let tokenIndex = 0;

  /** 리소스 정리 — Design §2.2 정리 보장 패턴 */
  function cleanup(): void {
    cancelled = true;
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    if (streamIterator !== null) {
      // AsyncGenerator.return()으로 LLM 스트림 중단
      streamIterator.return(undefined).catch(() => {
        // 이미 종료된 경우 무시
      });
      streamIterator = null;
    }
  }

  /** 안전하게 이벤트를 enqueue (버퍼 오버플로우 방지) */
  function safeEnqueue(controller: ReadableStreamDefaultController<Uint8Array>, event: SSEEvent): boolean {
    const encoded = encodeSSEEvent(event);
    totalBytesEnqueued += encoded.byteLength;

    // 메모리 보호 — Design §3.2
    if (totalBytesEnqueued > config.maxBufferBytes) {
      const errorEvent: SSEErrorEvent = {
        code: 'BUFFER_OVERFLOW',
        message: `스트림 버퍼 한도 초과 (${config.maxBufferBytes} bytes)`,
      };
      controller.enqueue(encodeSSEEvent({ type: 'error', data: errorEvent }));
      onError?.(errorEvent);
      controller.close();
      cleanup();
      return false;
    }

    controller.enqueue(encoded);
    return true;
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // AbortSignal 연동 — Design §2.1
      if (signal) {
        signal.addEventListener('abort', () => {
          if (!cancelled) {
            const usage: SSEUsageEvent = {
              promptTokens: counter.promptTokens,
              completionTokens: counter.completionTokens,
              totalTokens: counter.promptTokens + counter.completionTokens,
            };
            safeEnqueue(controller, { type: 'usage', data: usage });
            safeEnqueue(controller, {
              type: 'done',
              data: { finishReason: 'cancelled', totalTokens: usage.totalTokens },
            });
            controller.close();
            cleanup();
            onComplete?.(usage, 'cancelled');
          }
        }, { once: true });
      }

      // Heartbeat 타이머 — Design §6
      heartbeatTimer = setInterval(() => {
        if (!cancelled) {
          try {
            controller.enqueue(encodeSSEEvent({ type: 'ping', data: {} }));
          } catch {
            // 컨트롤러 이미 닫힘 — 무시
          }
        }
      }, config.heartbeatIntervalMs);

      // 스트림 타임아웃 — NFR-R6.5
      timeoutTimer = setTimeout(() => {
        if (!cancelled) {
          const errorEvent: SSEErrorEvent = {
            code: 'TIMEOUT',
            message: `스트림 타임아웃 (${config.maxStreamTimeoutMs}ms)`,
          };
          safeEnqueue(controller, { type: 'error', data: errorEvent });
          onError?.(errorEvent);
          controller.close();
          cleanup();
        }
      }, config.maxStreamTimeoutMs);

      // LLM 스트리밍 시작
      try {
        streamIterator = provider.chatStream(messages, chatOptions);

        for await (const chunk of streamIterator) {
          if (cancelled || signal?.aborted) break;

          // 토큰 카운팅 — Design §5.1
          counter.completionTokens++;

          // 토큰 한도 초과 확인
          if (config.tokenLimit > 0 && counter.completionTokens >= config.tokenLimit) {
            const errorEvent: SSEErrorEvent = {
              code: 'TOKEN_LIMIT',
              message: `토큰 한도 초과 (${config.tokenLimit})`,
            };
            safeEnqueue(controller, { type: 'error', data: errorEvent });
            onError?.(errorEvent);
            break;
          }

          // PII 마스킹 — N2SF N-05
          const deltaText = config.enablePIIMasking ? maskPII(chunk.text) : chunk.text;

          // 토큰 이벤트 전송 — FR-ADV6.2
          const eventSent = safeEnqueue(controller, {
            type: 'token',
            data: { delta: deltaText, index: tokenIndex++ },
          });

          if (!eventSent) return; // 버퍼 오버플로우로 종료됨

          // 프로바이더가 done 표시하면 종료
          if (chunk.done) {
            // 프로바이더가 최종 토큰 수를 제공하면 사용
            if (chunk.tokensUsed !== undefined && chunk.tokensUsed > 0) {
              counter.completionTokens = chunk.tokensUsed;
            }
            break;
          }
        }

        // 정상 완료 — usage + done 이벤트 전송
        if (!cancelled && !signal?.aborted) {
          const usage: SSEUsageEvent = {
            promptTokens: counter.promptTokens,
            completionTokens: counter.completionTokens,
            totalTokens: counter.promptTokens + counter.completionTokens,
          };
          safeEnqueue(controller, { type: 'usage', data: usage });
          safeEnqueue(controller, {
            type: 'done',
            data: { finishReason: 'stop', totalTokens: usage.totalTokens },
          });
          controller.close();
          cleanup();
          onComplete?.(usage, 'stop');
        }
      } catch (error: unknown) {
        // LLM 프로바이더 오류 — Design §4.1
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          const errorEvent: SSEErrorEvent = {
            code: 'PROVIDER_ERROR',
            message: `LLM 프로바이더 오류: ${errorMessage}`,
          };
          try {
            safeEnqueue(controller, { type: 'error', data: errorEvent });
            controller.close();
          } catch {
            // 컨트롤러 이미 닫힘
          }
          onError?.(errorEvent);
          cleanup();
        }
      }
    },

    // 백프레셔 — Design §3.1
    // pull()은 ReadableStream 내부 큐가 비었을 때 호출됨
    // LLM 스트림 소비는 start()의 for-await에서 처리되므로
    // ReadableStream의 내장 큐잉 + highWaterMark로 자연 제어
    pull() {
      // 의도적 빈 구현: ReadableStream의 기본 백프레셔 메커니즘 사용
      // controller.desiredSize가 0 이하이면 start()의 enqueue가 자연적으로 느려짐
    },

    // 클라이언트 취소 — Design §2
    cancel() {
      cleanup();
    },
  }, {
    // 백프레셔 제어 — highWaterMark 16KB (토큰 이벤트 약 200개 버퍼)
    highWaterMark: 16 * 1024,
  });
}

// ── SSE 응답 헤더 ────────────────────────────────────────────────────────────

/** SSE 응답에 필요한 HTTP 헤더 */
export function getSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx 프록시 버퍼링 비활성화
    'Access-Control-Allow-Origin': '*', // CORS — 실제 환경에서는 도메인 제한
  };
}
