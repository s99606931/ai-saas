// AI 서비스 라우트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.1~FR-P10.6
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  listModelsHandler,
  createModelHandler,
  updateModelHandler,
  chatHandler,
  usageHandler,
  costHandler,
} from './handlers/ai.handler.js';
import { aiUsageTrendHandler, modelAnalyticsHandler } from './handlers/ai-analytics.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증 — API 게이트웨이 우회 차단
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      // 헬스체크 경로 제외 (Kubernetes readinessProbe/livenessProbe 허용)
      if (request.url === '/health' || request.url === '/ready') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // CSAP D-08-06: Rate Limiting (AI 채팅은 비용 보호 목적 더 엄격)
  const readLimiter = createRateLimiter(100, 60, 'rl:ai:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:ai:write');
  const chatLimiter = createRateLimiter(10, 60, 'rl:ai:chat');

  // OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
  const modelResponse = {
    type: 'object' as const,
    properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
  };
  const listResponse = {
    type: 'object' as const,
    properties: {
      success: { type: 'boolean' as const },
      data: { type: 'array' as const, items: { type: 'object' as const } },
    },
  };
  const idParam = { type: 'object' as const, properties: { id: { type: 'string' as const, format: 'uuid' } } };

  app.get(
    '/ai/models',
    {
      schema: { description: 'AI 모델 목록 조회', tags: ['ai'], response: { 200: listResponse } },
      preHandler: readLimiter,
    },
    listModelsHandler as never,
  );

  app.post(
    '/ai/models',
    {
      schema: {
        description: 'AI 모델 등록',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['name', 'provider', 'endpoint'] as const,
          properties: {
            name: { type: 'string' as const },
            provider: { type: 'string' as const },
            endpoint: { type: 'string' as const, format: 'uri' },
            maxGrade: { type: 'string' as const, enum: ['O'] },
          },
        },
        response: { 201: modelResponse },
      },
      preHandler: writeLimiter,
    },
    createModelHandler as never,
  );

  app.put(
    '/ai/models/:id',
    {
      schema: {
        description: 'AI 모델 수정',
        tags: ['ai'],
        params: idParam,
        body: {
          type: 'object' as const,
          properties: { name: { type: 'string' as const }, endpoint: { type: 'string' as const } },
        },
        response: { 200: modelResponse },
      },
      preHandler: writeLimiter,
    },
    updateModelHandler as never,
  );

  app.post(
    '/ai/chat',
    {
      schema: {
        description: 'AI 채팅 (N2SF O등급 데이터만, PII 마스킹, 멀티모달 이미지 지원)',
        tags: ['ai'],
        body: {
          type: 'object' as const,
          required: ['modelId', 'tenantId', 'message', 'grade'] as const,
          properties: {
            modelId: { type: 'string' as const },
            tenantId: { type: 'string' as const },
            message: { type: 'string' as const, maxLength: 8192 },
            grade: { type: 'string' as const, enum: ['O'] },
            // 멀티모달: base64 또는 data URL 이미지 (최대 5개, 각 5MB)
            images: {
              type: 'array' as const,
              items: { type: 'string' as const },
              maxItems: 5,
            },
            systemPrompt: { type: 'string' as const, maxLength: 2048 },
          },
        },
        response: {
          200: modelResponse,
          403: {
            type: 'object' as const,
            properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
          },
          502: {
            type: 'object' as const,
            properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
          },
        },
      },
      preHandler: chatLimiter,
    },
    chatHandler as never,
  );

  app.get(
    '/ai/usage',
    {
      schema: { description: 'AI 사용량 조회', tags: ['ai'], response: { 200: modelResponse } },
      preHandler: readLimiter,
    },
    usageHandler as never,
  );

  app.get(
    '/ai/cost',
    {
      schema: { description: 'AI 비용 조회', tags: ['ai'], response: { 200: modelResponse } },
      preHandler: readLimiter,
    },
    costHandler as never,
  );

  // FR-AI.4: 일별 AI 사용량 추이
  app.get(
    '/ai/analytics/trend',
    {
      schema: {
        description: '일별 AI 사용량 추이',
        tags: ['ai'],
        querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, default: 30 } } },
        response: { 200: modelResponse },
      },
      preHandler: readLimiter,
    },
    aiUsageTrendHandler as never,
  );

  // FR-AI.5: 모델별 사용 분석
  app.get(
    '/ai/analytics/models',
    {
      schema: { description: '모델별 사용 분석', tags: ['ai'], response: { 200: listResponse } },
      preHandler: readLimiter,
    },
    modelAnalyticsHandler as never,
  );
}
