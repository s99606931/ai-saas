// 카탈로그 서비스 라우트
// Design Ref: DESIGN-MTU-P06, SVC-CAT-R1 DESIGN
// Plan SC: FR-P06.1~FR-P06.5, FR-CAT.1~FR-CAT.5

import type { FastifyInstance } from 'fastify';
import {
  listServicesHandler,
  getServiceHandler,
  createServiceHandler,
  updateServiceHandler,
  deleteServiceHandler,
  updateVersionHandler,
  listFlagsHandler,
  toggleFlagHandler,
} from './handlers/catalog.handler.js';
import { listCategoriesHandler, catalogStatsHandler } from './handlers/catalog-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
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

  // FR-CAT.1: Rate Limiting (Design Ref: SVC-CAT-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:catalog:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:catalog:write');
  const deleteLimiter = createRateLimiter(5, 300, 'rl:catalog:delete');

  // 정적 경로 우선 등록
  // FR-CAT.3: 카테고리 목록
  app.get('/catalog/categories', { preHandler: readLimiter }, listCategoriesHandler as never);

  // FR-CAT.5: 서비스 통계
  app.get('/catalog/stats', { preHandler: readLimiter }, catalogStatsHandler as never);

  // FR-P06.1 + FR-CAT.2: 서비스 목록 (검색 포함)
  app.get('/catalog/services', { preHandler: readLimiter }, listServicesHandler as never);

  // FR-P06.1: 서비스 상세
  app.get('/catalog/services/:id', { preHandler: readLimiter }, getServiceHandler as never);

  // FR-P06.1: 서비스 등록
  app.post('/catalog/services', { preHandler: writeLimiter }, createServiceHandler as never);

  // FR-P06.1: 서비스 수정
  app.put('/catalog/services/:id', { preHandler: writeLimiter }, updateServiceHandler as never);

  // FR-P06.1: 서비스 삭제
  app.delete('/catalog/services/:id', { preHandler: deleteLimiter }, deleteServiceHandler as never);

  // FR-P06.2: 버전 업데이트
  app.put('/catalog/services/:id/version', { preHandler: writeLimiter }, updateVersionHandler as never);

  // FR-P06.3: Feature Flag 목록
  app.get('/catalog/services/:id/flags', { preHandler: readLimiter }, listFlagsHandler as never);

  // FR-P06.3 + FR-CAT.4: Feature Flag 토글 (감사 로그 포함)
  app.put('/catalog/services/:id/flags/:key', { preHandler: writeLimiter }, toggleFlagHandler as never);
}
