// LLM 제공자 관리 핸들러
// Design Ref: SVC-AI-R3 DESIGN §4 FR-AI-R3.4
// CSAP: D-07 가용성 모니터링

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getLLMConfig, createLLMProvider } from '../lib/llm-provider.js';
import { modelRouter } from '../lib/model-router.js';

/**
 * GET /ai/provider/health — 현재 LLM 제공자 헬스체크
 * Design Ref: SVC-AI-R3 DESIGN §4 FR-AI-R3.4
 */
export async function providerHealthHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const config = getLLMConfig();
  const provider = await createLLMProvider(config);

  const health = await provider.healthCheck();

  await reply.send({
    success: health.status === 'healthy',
    data: {
      provider: config.providerType,
      baseUrl: config.baseUrl,
      model: config.model,
      status: health.status,
      responseTimeMs: health.responseTimeMs,
      models: health.models,
      checkedAt: new Date().toISOString(),
    },
  });
}

/**
 * GET /ai/provider/models — LLM 서버에 로드된 모델 목록
 * Design Ref: SVC-AI-R3 DESIGN §3 FR-AI-R3.3
 */
export async function providerModelsHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const config = getLLMConfig();
  const provider = await createLLMProvider(config);

  const health = await provider.healthCheck();

  const classified = health.models.map((modelId) => ({
    id: modelId,
    type: modelRouter.classifyModelType(modelId),
    provider: config.providerType,
  }));

  await reply.send({
    success: true,
    data: {
      provider: config.providerType,
      baseUrl: config.baseUrl,
      models: classified,
      total: classified.length,
    },
  });
}
