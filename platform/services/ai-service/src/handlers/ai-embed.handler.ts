// AI 임베딩 핸들러
// Design Ref: SVC-AI-R3 DESIGN §2 FR-AI-R3.2
// CSAP: N2SF N-05 — O등급 데이터만 임베딩 허용, PII 마스킹 필수
// 지원 모델: text-embedding-qwen3-embedding-0.6b, text-embedding-nomic-embed-text-v1.5

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateDataGrade, DataGradeViolationError } from '../lib/grade-check.js';
import { maskPII } from '../lib/pii-masking.js';
import { logAiEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { buildLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import type { DataGrade } from '@public-saas/types';

const TOKEN_COST_PER_UNIT = 0.00001; // 임베딩은 채팅보다 저렴

const embedSchema = z.object({
  modelId: z.string().min(1),
  tenantId: z.string().min(1),
  texts: z.array(z.string().min(1).max(8192)).min(1).max(100),
  grade: z.enum(['O', 'S', 'C']),
});

/**
 * POST /ai/embed — 텍스트 임베딩 벡터 생성
 * Design Ref: SVC-AI-R3 DESIGN §2 FR-AI-R3.2
 *
 * 응답: { embeddings: number[][], model, dimensions, tokensUsed }
 */
export async function embedHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = embedSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { modelId, tenantId, texts, grade } = parseResult.data;
  const actor = (request.headers['x-user-id'] as string) || 'system';

  // N2SF N-05: 데이터 등급 검증
  try {
    validateDataGrade(grade as DataGrade);
  } catch (error) {
    if (error instanceof DataGradeViolationError) {
      await logAiEvent('AI_GRADE_VIOLATION', actor, modelId, tenantId, request.ip,
        request.headers['user-agent'] ?? 'unknown', { grade, blocked: true, endpoint: 'embed' });
      await reply.status(403).send({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    throw error;
  }

  // PII 마스킹 (O등급 데이터 전처리)
  const maskedTexts = texts.map(maskPII);

  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  if (!model || !model.isActive) {
    await reply.status(404).send({ success: false, error: { code: 'MODEL_NOT_FOUND', message: 'AI 모델을 찾을 수 없습니다' } });
    return;
  }

  const llmConfig = buildLLMConfig({ provider: model.provider, endpoint: model.endpoint, name: model.name, config: model.config });
  const provider = await createLLMProvider(llmConfig);

  let embedResult: { embeddings: number[][]; model: string; dimensions: number; tokensUsed: number };
  try {
    embedResult = await provider.embed(maskedTexts);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logAiEvent('AI_LLM_ERROR', actor, modelId, tenantId, request.ip,
      request.headers['user-agent'] ?? 'unknown',
      { provider: llmConfig.providerType, error: errorMessage.slice(0, 200), endpoint: 'embed' });
    await reply.status(502).send({ success: false, error: { code: 'LLM_UNAVAILABLE', message: '임베딩 서버 오류' } });
    return;
  }

  // 사용량 기록
  await prisma.aiUsage.create({
    data: {
      modelId,
      tenantId,
      tokens: embedResult.tokensUsed,
      cost: embedResult.tokensUsed * TOKEN_COST_PER_UNIT,
      grade,
    },
  });

  await logAiEvent('AI_EMBED_COMPLETED', actor, modelId, tenantId, request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { grade, tokens: embedResult.tokensUsed, provider: llmConfig.providerType, textCount: texts.length, dimensions: embedResult.dimensions });

  await reply.send({
    success: true,
    data: {
      embeddings: embedResult.embeddings,
      model: embedResult.model,
      dimensions: embedResult.dimensions,
      tokensUsed: embedResult.tokensUsed,
    },
  });
}
