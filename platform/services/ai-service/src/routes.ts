// AI 서비스 라우트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.1~FR-P10.6

import type { FastifyInstance } from 'fastify';
import {
  listModelsHandler,
  createModelHandler,
  updateModelHandler,
  chatHandler,
  usageHandler,
  costHandler,
} from './handlers/ai.handler.js';

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

  app.get('/ai/models', listModelsHandler);
  app.post('/ai/models', createModelHandler);
  app.put('/ai/models/:id', updateModelHandler);
  app.post('/ai/chat', chatHandler);
  app.get('/ai/usage', usageHandler);
  app.get('/ai/cost', costHandler);
}
