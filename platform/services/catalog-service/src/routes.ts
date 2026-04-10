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

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
} as const;

const errorResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
} as const;

const paginationQuery = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer' as const, minimum: 1, default: 1 },
    limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
    search: { type: 'string' as const },
  },
} as const;

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
} as const;

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

  // FR-CAT.3: 카테고리 목록
  app.get('/catalog/categories', {
    schema: { description: '서비스 카테고리 목록 조회', tags: ['catalog'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listCategoriesHandler as never);

  // FR-CAT.5: 서비스 통계
  app.get('/catalog/stats', {
    schema: { description: '서비스 카탈로그 통계', tags: ['catalog'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, catalogStatsHandler as never);

  // FR-P06.1 + FR-CAT.2: 서비스 목록 (검색 포함)
  app.get('/catalog/services', {
    schema: { description: '서비스 목록 조회 (검색/페이지네이션)', tags: ['catalog'], querystring: paginationQuery, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listServicesHandler as never);

  // FR-P06.1: 서비스 상세
  app.get('/catalog/services/:id', {
    schema: { description: '서비스 상세 조회', tags: ['catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getServiceHandler as never);

  // FR-P06.1: 서비스 등록
  app.post('/catalog/services', {
    schema: {
      description: '서비스 등록',
      tags: ['catalog'],
      body: {
        type: 'object' as const,
        required: ['name', 'category'],
        properties: {
          name: { type: 'string' as const, minLength: 1 },
          category: { type: 'string' as const },
          description: { type: 'string' as const },
          version: { type: 'string' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createServiceHandler as never);

  // FR-P06.1: 서비스 수정
  app.put('/catalog/services/:id', {
    schema: {
      description: '서비스 수정',
      tags: ['catalog'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, category: { type: 'string' as const }, description: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updateServiceHandler as never);

  // FR-P06.1: 서비스 삭제
  app.delete('/catalog/services/:id', {
    schema: { description: '서비스 삭제', tags: ['catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: deleteLimiter,
  }, deleteServiceHandler as never);

  // FR-P06.2: 버전 업데이트
  app.put('/catalog/services/:id/version', {
    schema: {
      description: '서비스 버전 업데이트',
      tags: ['catalog'],
      params: idParam,
      body: { type: 'object' as const, required: ['version'], properties: { version: { type: 'string' as const }, changelog: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updateVersionHandler as never);

  // FR-P06.3: Feature Flag 목록
  app.get('/catalog/services/:id/flags', {
    schema: { description: 'Feature Flag 목록 조회', tags: ['catalog'], params: idParam, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listFlagsHandler as never);

  // FR-P06.3 + FR-CAT.4: Feature Flag 토글 (감사 로그 포함)
  app.put('/catalog/services/:id/flags/:key', {
    schema: {
      description: 'Feature Flag 토글 (감사 로그 포함)',
      tags: ['catalog'],
      params: { type: 'object' as const, required: ['id', 'key'], properties: { id: { type: 'string' as const }, key: { type: 'string' as const } } },
      body: { type: 'object' as const, required: ['enabled'], properties: { enabled: { type: 'boolean' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, toggleFlagHandler as never);
}
