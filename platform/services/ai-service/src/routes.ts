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

  app.get('/ai/models', { preHandler: readLimiter }, listModelsHandler as never);
  app.post('/ai/models', { preHandler: writeLimiter }, createModelHandler as never);
  app.put('/ai/models/:id', { preHandler: writeLimiter }, updateModelHandler as never);
  app.post('/ai/chat', { preHandler: chatLimiter }, chatHandler as never);
  app.get('/ai/usage', { preHandler: readLimiter }, usageHandler as never);
  app.get('/ai/cost', { preHandler: readLimiter }, costHandler as never);

  // FR-AI.4: 일별 AI 사용량 추이
  app.get('/ai/analytics/trend', { preHandler: readLimiter }, aiUsageTrendHandler as never);

  // FR-AI.5: 모델별 사용 분석
  app.get('/ai/analytics/models', { preHandler: readLimiter }, modelAnalyticsHandler as never);
}
