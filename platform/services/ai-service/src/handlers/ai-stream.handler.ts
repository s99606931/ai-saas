// AI 스트리밍 핸들러 — SSE (Server-Sent Events)
// Design Ref: SVC-AI-R3 DESIGN §1 FR-AI-R3.1
// CSAP: N2SF N-05 — C/S등급 전송 절대 금지, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import { maskPII } from '../lib/pii-masking.js';
import { checkPromptInjection } from '../lib/prompt-guard.js';
import { checkUsageLimit } from '../lib/usage-limit.js';
import { logAiEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import type { LLMMessage } from '../lib/llm-provider.js';
import type { DataGrade } from '@public-saas/types';

const chatStreamSchema = z.object({
  modelId: z.string().min(1),
  tenantId: z.string().min(1),
  message: z.string().min(1).max(8192),
  grade: z.enum(['O', 'S', 'C']),
  systemPrompt: z.string().max(2048).optional(),
});

/**
 * POST /ai/chat/stream — SSE 스트리밍 채팅
 * Design Ref: SVC-AI-R3 DESIGN §1 FR-AI-R3.1
 *
 * 응답 형식 (text/event-stream):
 *   data: {"text":"안녕"}
 *   data: {"text":"하세요"}
 *   data: {"done":true,"tokens":412}
 *   data: [DONE]
 */
export async function chatStreamHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = chatStreamSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { modelId, tenantId, message, grade, systemPrompt } = parseResult.data;
  const chatActor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: 데이터 등급 검증
  try {
    validateDataGrade(grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', chatActor, modelId, tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  // 프롬프트 인젝션 방어
  const guardResult = checkPromptInjection(message);
  if (guardResult.blocked) {
    await logAiEvent('AI_PROMPT_INJECTION_BLOCKED', chatActor, modelId, tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { totalSeverity: guardResult.totalSeverity, detections: guardResult.detections.map((d) => d.description) });
    await reply.status(400).send({
      success: false,
      error: { code: 'PROMPT_INJECTION_DETECTED', message: '안전하지 않은 프롬프트가 감지되었습니다.' },
    });
    return;
  }

  // 사용량 제한
  const usageLimit = await checkUsageLimit(tenantId);
  if (!usageLimit.allowed) {
    await logAiEvent('AI_USAGE_LIMIT_EXCEEDED', chatActor, modelId, tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { usedToday: usageLimit.usedToday, dailyLimit: usageLimit.dailyLimit });
    await reply.status(429).send({
      success: false,
      error: { code: 'AI_USAGE_LIMIT_EXCEEDED', message: `일일 한도 초과 (${usageLimit.usedToday}/${usageLimit.dailyLimit})` },
    });
    return;
  }

  const maskedMessage = maskPII(message);
  const maskedSystemPrompt = systemPrompt ? maskPII(systemPrompt) : undefined;

  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  if (!model || !model.isActive) {
    await reply.status(404).send({ success: false, error: { code: 'MODEL_NOT_FOUND', message: 'AI 모델을 찾을 수 없습니다' } });
    return;
  }

  const llmConfig = buildLLMConfig({ provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config });
  const provider = await createLLMProvider(llmConfig);

  const messages: LLMMessage[] = [
    ...(maskedSystemPrompt ? [{ role: 'system' as const, content: maskedSystemPrompt }] : []),
    { role: 'user' as const, content: maskedMessage },
  ];

  // SSE 헤더 설정 (Fastify raw response 사용)
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no'); // Nginx 프록시 버퍼링 비활성화
  reply.raw.flushHeaders();

  let totalTokens = 0;
  let streamErrored = false;

  try {
    for await (const chunk of provider.chatStream(messages)) {
      if (chunk.done) {
        totalTokens = chunk.tokensUsed ?? totalTokens;
        break;
      }
      // PII 마스킹 후 전송
      const safeText = maskPII(chunk.text);
      reply.raw.write(`data: ${JSON.stringify({ text: safeText })}\n\n`);
    }
  } catch (err) {
    streamErrored = true;
    const errorMessage = err instanceof Error ? err.message : String(err);
    reply.raw.write(`data: ${JSON.stringify({ error: 'AI 스트림 오류', code: 'LLM_STREAM_ERROR' })}\n\n`);
    await logAiEvent('AI_LLM_ERROR', chatActor, modelId, tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { provider: llmConfig.providerType, error: errorMessage.slice(0, 200), stream: true });
  }

  if (!streamErrored) {
    reply.raw.write(`data: ${JSON.stringify({ done: true, tokens: totalTokens })}\n\n`);
    // 사용량 기록
    if (totalTokens > 0) {
      await prisma.aiUsage.create({
        data: { modelId, tenantId, tokens: totalTokens, cost: totalTokens * 0.0001, grade },
      });
    }
    await logAiEvent('AI_STREAM_COMPLETED', chatActor, modelId, tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { grade, tokens: totalTokens, provider: llmConfig.providerType });
  }

  reply.raw.write('data: [DONE]\n\n');
  reply.raw.end();
}
