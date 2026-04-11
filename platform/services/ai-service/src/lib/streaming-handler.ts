// 스트리밍 요청/응답 핸들러 — FR-ADV6.3, FR-ADV6.6, FR-ADV6.8
// Design Ref: SVC-AI-ADV-R6 DESIGN §2, §5, §7
// Plan SC: SC-2 (취소 시 리소스 해제), SC-5 (토큰 집계), SC-6 (인증 게이트)
// CSAP: D-08 접근 통제, D-06 감사 로깅, D-12 시스템 개발 보안

import { z } from 'zod';
import { createSSEStream, getSSEHeaders } from './ai-streaming.js';
import type { CreateSSEStreamOptions, SSEUsageEvent, SSEErrorEvent, StreamingConfig } from './ai-streaming.js';
import type { LLMProvider, LLMMessage, LLMChatOptions } from './llm-provider.js';
import { createLLMProvider, getLLMConfig } from './llm-provider.js';
import { checkUsageLimit } from './usage-limit.js';
import { logAiEvent } from './audit.js';
import { maskPII } from './pii-masking.js';

// ── 요청 스키마 (Zod 검증 — CSAP D-12) ──────────────────────────────────────

/** 스트리밍 채팅 요청 스키마 */
const streamingChatRequestSchema = z.object({
  /** 채팅 메시지 배열 */
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(100_000),
  })).min(1).max(100),
  /** 모델 ID (선택, 기본값은 환경 변수) */
  model: z.string().max(200).optional(),
  /** 최대 생성 토큰 수 */
  maxTokens: z.number().int().min(1).max(32_768).optional(),
  /** 온도 (0.0 ~ 2.0) */
  temperature: z.number().min(0).max(2).optional(),
  /** 토큰 한도 (0 = 무제한) */
  tokenLimit: z.number().int().min(0).max(100_000).optional(),
});

export type StreamingChatRequest = z.infer<typeof streamingChatRequestSchema>;

// ── 인증 인터페이스 ──────────────────────────────────────────────────────────

/** 인증된 사용자 정보 (JWT에서 추출) */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roles: string[];
}

/** JWT 검증 함수 시그니처 */
export type VerifyTokenFn = (authHeader: string | null) => Promise<AuthenticatedUser | null>;

/** 권한 검사 함수 시그니처 */
export type CheckPermissionFn = (user: AuthenticatedUser, permission: string) => boolean;

// ── 스트리밍 핸들러 ──────────────────────────────────────────────────────────

/** 핸들러 설정 */
export interface StreamingHandlerConfig {
  /** JWT 검증 함수 */
  verifyToken: VerifyTokenFn;
  /** 권한 검사 함수 */
  checkPermission: CheckPermissionFn;
  /** LLM 프로바이더 (선택, 미제공 시 기본 설정 사용) */
  provider?: LLMProvider;
  /** 스트리밍 설정 오버라이드 */
  streamingConfig?: StreamingConfig;
}

/**
 * 스트리밍 채팅 요청을 처리하는 HTTP 핸들러를 생성합니다.
 *
 * 처리 흐름:
 * 1. JWT 인증 검증 (CSAP D-08) — Design §7
 * 2. 권한(ai:stream) 검사
 * 3. 요청 본문 Zod 검증 (CSAP D-12)
 * 4. 사용량 한도 확인
 * 5. PII 마스킹 (N2SF N-05)
 * 6. SSE 스트림 생성 및 응답
 * 7. 완료/에러 시 감사 로그 기록 (CSAP D-06)
 *
 * @param handlerConfig - 핸들러 설정
 * @returns HTTP 요청 핸들러 함수
 */
export function createStreamingHandler(handlerConfig: StreamingHandlerConfig) {
  const { verifyToken, checkPermission, streamingConfig } = handlerConfig;

  return async function handleStreamingChat(req: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // ── 1. JWT 인증 검증 — CSAP D-08, Design §7 ──────────────────────
    const authHeader = req.headers.get('authorization');
    const user = await verifyToken(authHeader);

    if (!user) {
      await logAiEvent(
        'AI_STREAM_AUTH_FAILED', 'anonymous', requestId, 'unknown',
        'streaming-handler', 'unknown',
      );
      return Response.json(
        { error: '인증이 필요합니다', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    // ── 2. 권한 검사 — CSAP D-08 ─────────────────────────────────────
    if (!checkPermission(user, 'ai:stream')) {
      await logAiEvent(
        'AI_STREAM_PERMISSION_DENIED', user.userId, requestId, user.tenantId,
        'streaming-handler', 'unknown',
        { permission: 'ai:stream' },
      );
      return Response.json(
        { error: '스트리밍 권한이 없습니다', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // ── 3. 요청 본문 검증 — CSAP D-12 ────────────────────────────────
    let body: StreamingChatRequest;
    try {
      const rawBody: unknown = await req.json();
      body = streamingChatRequestSchema.parse(rawBody);
    } catch (error: unknown) {
      const message = error instanceof z.ZodError
        ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        : '잘못된 요청 형식';
      return Response.json(
        { error: message, code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // ── 4. 사용량 한도 확인 ───────────────────────────────────────────
    const usageLimit = await checkUsageLimit(user.tenantId);
    if (!usageLimit.allowed) {
      await logAiEvent(
        'AI_STREAM_RATE_LIMITED', user.userId, requestId, user.tenantId,
        'streaming-handler', 'unknown',
        { usedToday: usageLimit.usedToday, dailyLimit: usageLimit.dailyLimit },
      );
      return Response.json(
        {
          error: '일일 AI 사용량 한도를 초과했습니다',
          code: 'RATE_LIMITED',
          usedToday: usageLimit.usedToday,
          dailyLimit: usageLimit.dailyLimit,
        },
        { status: 429 },
      );
    }

    // ── 5. PII 마스킹 (N2SF N-05) ────────────────────────────────────
    const maskedMessages: LLMMessage[] = body.messages.map((msg) => ({
      role: msg.role,
      content: maskPII(msg.content),
    }));

    // ── 6. LLM 프로바이더 준비 ────────────────────────────────────────
    let provider: LLMProvider;
    try {
      provider = handlerConfig.provider ?? await createLLMProvider(getLLMConfig());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'LLM 프로바이더 초기화 실패';
      return Response.json(
        { error: errorMessage, code: 'PROVIDER_INIT_ERROR' },
        { status: 503 },
      );
    }

    // ── 7. 감사 로그: 스트림 시작 ─────────────────────────────────────
    await logAiEvent(
      'AI_STREAM_START', user.userId, requestId, user.tenantId,
      'streaming-handler', 'unknown',
      { messageCount: body.messages.length },
    );

    // ── 8. SSE 스트림 생성 ────────────────────────────────────────────
    const chatOptions: LLMChatOptions = {
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    };

    const streamOptions: CreateSSEStreamOptions = {
      provider,
      messages: maskedMessages,
      chatOptions,
      signal: req.signal,
      config: {
        ...streamingConfig,
        tokenLimit: body.tokenLimit ?? streamingConfig?.tokenLimit ?? 0,
        promptTokens: estimatePromptTokens(maskedMessages),
      },

      // 완료 콜백 — 감사 로그 + 사용량 기록
      onComplete: (usage: SSEUsageEvent, finishReason: string) => {
        const durationMs = Date.now() - startTime;
        logAiEvent(
          'AI_STREAM_COMPLETE', user.userId, requestId, user.tenantId,
          'streaming-handler', 'unknown',
          { finishReason, totalTokens: usage.totalTokens, durationMs },
        ).catch(() => {
          // 감사 로그 실패 시 콘솔 경고 (스트림은 이미 완료)
          // eslint-disable-next-line no-console
          console.warn(`[audit] 감사 로그 기록 실패: ${requestId}`);
        });
      },

      // 에러 콜백 — 감사 로그
      onError: (error: SSEErrorEvent) => {
        logAiEvent(
          'AI_STREAM_ERROR', user.userId, requestId, user.tenantId,
          'streaming-handler', 'unknown',
          { errorCode: error.code, errorMessage: error.message },
        ).catch(() => {
          // eslint-disable-next-line no-console
          console.warn(`[audit] 에러 감사 로그 기록 실패: ${requestId}`);
        });
      },
    };

    const sseStream = createSSEStream(streamOptions);

    // ── 9. SSE 응답 반환 ──────────────────────────────────────────────
    return new Response(sseStream, {
      status: 200,
      headers: {
        ...getSSEHeaders(),
        'X-Request-Id': requestId,
      },
    });
  };
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/**
 * 메시지 배열에서 프롬프트 토큰 수를 추정합니다.
 * 정확한 토크나이저 없이 문자 수 기반 근사치를 사용합니다.
 * 한국어는 평균 1.5 토큰/글자, 영문은 0.25 토큰/글자로 추정합니다.
 *
 * @param messages - 메시지 배열
 * @returns 추정 프롬프트 토큰 수
 */
function estimatePromptTokens(messages: LLMMessage[]): number {
  let totalChars = 0;
  let koreanChars = 0;

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    totalChars += content.length;

    // 한국어 문자 감지 (한글 유니코드 범위)
    for (const char of content) {
      const code = char.codePointAt(0) ?? 0;
      if ((code >= 0xAC00 && code <= 0xD7AF) || // 한글 음절
          (code >= 0x3130 && code <= 0x318F) || // 한글 호환 자모
          (code >= 0x1100 && code <= 0x11FF)) { // 한글 자모
        koreanChars++;
      }
    }
  }

  const englishChars = totalChars - koreanChars;
  const estimatedTokens = Math.ceil(koreanChars * 1.5 + englishChars * 0.25);

  // 메시지 오버헤드 (role 등) 약 4 토큰/메시지
  return estimatedTokens + messages.length * 4;
}

/**
 * Express/Hono 등 프레임워크에서 사용할 수 있는 간단한 스트리밍 미들웨어를 생성합니다.
 *
 * @param config - 핸들러 설정
 * @returns 미들웨어 함수
 */
export function createStreamingMiddleware(config: StreamingHandlerConfig) {
  const handler = createStreamingHandler(config);

  return {
    handler,
    /** 경로: POST /api/ai/chat/stream */
    path: '/api/ai/chat/stream' as const,
    method: 'POST' as const,
  };
}
