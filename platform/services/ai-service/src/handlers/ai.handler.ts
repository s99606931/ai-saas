// AI 서비스 핸들러
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.1~FR-P10.6
// CSAP: N2SF N-05 — C/S등급 AI API 전송 절대 금지

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import { maskPII } from '../lib/pii-masking.js';
import { checkPromptInjection } from '../lib/prompt-guard.js';
import { checkUsageLimit } from '../lib/usage-limit.js';
import { logAiEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import type { LLMMessage, LLMContentPart } from '../lib/llm-provider.js';
import type { DataGrade } from '@public-saas/types';

// 토큰당 비용 계수 (원/토큰, 운영 환경에서 환경 변수로 오버라이드 가능)
const TOKEN_COST_PER_UNIT = 0.0001;

const createModelSchema = z.object({
  name: z.string().min(1, '모델명은 필수입니다').max(100),
  provider: z.enum(['openai', 'ollama', 'vllm', 'lmstudio']),
  endpoint: z.string().url('올바른 URL 형식이어야 합니다'),
  maxGrade: z.enum(['O', 'S', 'C']).default('O'),
  config: z.record(z.unknown()).optional(),
});

const chatSchema = z.object({
  modelId: z.string().min(1),
  tenantId: z.string().min(1),
  message: z.string().min(1).max(8192),
  grade: z.enum(['O', 'S', 'C']),
  // 멀티모달: base64 또는 data URL 형식 이미지 (N2SF O등급만 허용, PII 마스킹 불가 주의)
  images: z.array(z.string().max(5 * 1024 * 1024)).max(5).optional(),
  systemPrompt: z.string().max(2048).optional(),
});

/**
 * AI 모델 목록 조회
 * Plan SC: FR-P10.1
 */
export async function listModelsHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-10: 페이지네이션으로 DoS 방어 (최대 100건)
  const models = await prisma.aiModel.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    take: 100,
  });

  await reply.send({ success: true, data: models });
}

/**
 * AI 모델 등록
 * Plan SC: FR-P10.1
 */
export async function createModelHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = createModelSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const model = await prisma.aiModel.create({
    data: parseResult.data as Parameters<typeof prisma.aiModel.create>[0]['data'],
  });

  const modelActor = (request.headers['x-user-id'] as string) || 'system';
  await logAiEvent(
    'AI_MODEL_REGISTERED',
    modelActor,
    model.id,
    'platform',
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { name: model.name, provider: model.provider },
  );

  await reply.status(201).send({ success: true, data: model });
}

/**
 * AI 모델 수정
 * Plan SC: FR-P10.1
 */
export async function updateModelHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({
    name: z.string().optional(),
    endpoint: z.string().url().optional(),
    isActive: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
  });

  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const model = await prisma.aiModel.update({
    where: { id: request.params.id },
    data: parseResult.data as Parameters<typeof prisma.aiModel.update>[0]['data'],
  });

  await reply.send({ success: true, data: model });
}

/**
 * AI 채팅 (등급 검증 + PII 마스킹 + 실제 LLM 호출)
 * Plan SC: FR-P10.2, FR-P10.3
 * CSAP: N2SF N-05 — C/S등급 전송 절대 금지
 * 지원 제공자: openai | lmstudio | vllm | ollama (LLM_PROVIDER 환경 변수)
 */
export async function chatHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = chatSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { modelId, tenantId, message, grade, images, systemPrompt } = parseResult.data;

  // actor 추출: JWT 클레임 기반 (CSAP D-06: 행위자 추적)
  const chatActor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: C/S등급 데이터 전송 절대 금지
  try {
    validateDataGrade(grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent(
        'AI_GRADE_VIOLATION',
        chatActor,
        modelId,
        tenantId,
        request.ip,
        request.headers['user-agent'] ?? 'unknown',
        { grade, blocked: true },
      );
      await reply.status(403).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    throw error;
  }

  // FR-AI.1: 프롬프트 인젝션 방어
  const guardResult = checkPromptInjection(message);
  if (guardResult.blocked) {
    await logAiEvent(
      'AI_PROMPT_INJECTION_BLOCKED',
      chatActor,
      modelId,
      tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      {
        totalSeverity: guardResult.totalSeverity,
        detections: guardResult.detections.map((d) => d.description),
      },
    );
    await reply.status(400).send({
      success: false,
      error: {
        code: 'PROMPT_INJECTION_DETECTED',
        message: '안전하지 않은 프롬프트가 감지되었습니다. 요청이 차단되었습니다.',
      },
    });
    return;
  }

  // FR-AI.3: 테넌트별 일일 사용량 제한
  const usageLimit = await checkUsageLimit(tenantId);
  if (!usageLimit.allowed) {
    await logAiEvent(
      'AI_USAGE_LIMIT_EXCEEDED',
      chatActor,
      modelId,
      tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { usedToday: usageLimit.usedToday, dailyLimit: usageLimit.dailyLimit },
    );
    await reply.status(429).send({
      success: false,
      error: {
        code: 'AI_USAGE_LIMIT_EXCEEDED',
        message: `일일 AI 사용량 한도를 초과했습니다 (${usageLimit.usedToday}/${usageLimit.dailyLimit} 토큰)`,
        usedToday: usageLimit.usedToday,
        dailyLimit: usageLimit.dailyLimit,
      },
    });
    return;
  }

  // O등급: 텍스트 메시지 PII 마스킹 (이미지는 마스킹 불가 — 전송 전 확인 필요)
  const maskedMessage = maskPII(message);
  const maskedSystemPrompt = systemPrompt ? maskPII(systemPrompt) : undefined;

  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  if (!model || !model.isActive) {
    await reply.status(404).send({
      success: false,
      error: { code: 'MODEL_NOT_FOUND', message: 'AI 모델을 찾을 수 없습니다' },
    });
    return;
  }

  // LLM 제공자 설정: DB 모델 정보 + 환경 변수 기본값
  const llmConfig = buildLLMConfig({
    provider: model.provider,
    endpoint: model.endpoint,
    name: model.name,
    config: model.config,
  });
  const provider = await createLLMProvider(llmConfig);

  // 메시지 구성 (멀티모달: 이미지가 있으면 content를 배열로 구성)
  const userContent: string | LLMContentPart[] = images && images.length > 0 && provider.isMultimodal
    ? [
        { type: 'text' as const, text: maskedMessage },
        ...images.map((img): LLMContentPart => ({
          type: 'image_url' as const,
          image_url: {
            // data URL이 아닌 경우 base64 data URL 형식으로 변환
            url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
          },
        })),
      ]
    : maskedMessage;

  const messages: LLMMessage[] = [
    ...(maskedSystemPrompt ? [{ role: 'system' as const, content: maskedSystemPrompt }] : []),
    { role: 'user' as const, content: userContent },
  ];

  // 실제 LLM API 호출
  let llmResponse: { text: string; tokensUsed: number; model: string };
  try {
    llmResponse = await provider.chat(messages);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logAiEvent(
      'AI_LLM_ERROR',
      chatActor,
      modelId,
      tenantId,
      request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { provider: llmConfig.providerType, error: errorMessage.slice(0, 200) },
    );
    await reply.status(502).send({
      success: false,
      error: { code: 'LLM_UNAVAILABLE', message: 'AI 모델 서버와 통신 중 오류가 발생했습니다' },
    });
    return;
  }

  // FR-AI.2: 응답 PII 필터링 (AI 응답에서 PII 재출현 방지)
  const responseText = maskPII(llmResponse.text);
  const tokensUsed = llmResponse.tokensUsed;

  // 사용량 기록 (FR-P10.4)
  await prisma.aiUsage.create({
    data: {
      modelId,
      tenantId,
      tokens: tokensUsed,
      cost: tokensUsed * TOKEN_COST_PER_UNIT,
      grade,
    },
  });

  // 감사 로그 (FR-P10.6, CSAP D-06)
  await logAiEvent(
    'AI_CHAT_COMPLETED',
    chatActor,
    modelId,
    tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    {
      grade,
      tokens: tokensUsed,
      piiMasked: message !== maskedMessage,
      provider: llmConfig.providerType,
      model: llmResponse.model,
      hasImages: (images?.length ?? 0) > 0,
    },
  );

  await reply.send({
    success: true,
    data: {
      response: responseText,
      tokens: tokensUsed,
      grade,
      piiMasked: message !== maskedMessage,
      provider: llmConfig.providerType,
      model: llmResponse.model,
    },
  });
}

/**
 * 사용량 조회 (테넌트별)
 * Plan SC: FR-P10.4
 */
export async function usageHandler(
  request: FastifyRequest<{ Querystring: { tenantId: string; from?: string; to?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId, from, to } = request.query;
  const where: Record<string, unknown> = { tenantId };
  if (from || to) {
    where['createdAt'] = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const usage = await prisma.aiUsage.aggregate({
    where,
    _sum: { tokens: true, cost: true },
    _count: true,
  });

  await reply.send({
    success: true,
    data: {
      totalTokens: usage._sum.tokens ?? 0,
      totalCost: usage._sum.cost?.toString() ?? '0',
      callCount: usage._count,
    },
  });
}

/**
 * 비용 조회
 * Plan SC: FR-P10.5
 */
export async function costHandler(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const where = request.query.tenantId ? { tenantId: request.query.tenantId } : {};

  const cost = await prisma.aiUsage.groupBy({
    by: ['modelId'],
    where,
    _sum: { tokens: true, cost: true },
    _count: true,
  });

  await reply.send({ success: true, data: cost });
}
