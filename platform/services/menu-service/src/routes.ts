// 메뉴 서비스 라우트
// Design Ref: DESIGN-MTU-P05, SVC-MENU-R1 DESIGN
// Plan SC: FR-P05.1~FR-P05.5, FR-MENU.1~FR-MENU.5

import type { FastifyInstance } from 'fastify';
import {
  getMenuTreeHandler,
  getFilteredMenuHandler,
  createMenuHandler,
  updateMenuHandler,
  deleteMenuHandler,
  reorderMenuHandler,
  searchMenuHandler,
} from './handlers/menu.handler.js';
import { menuStatsHandler } from './handlers/menu-stats.handler.js';
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

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
} as const;

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

  // FR-MENU.1: Rate Limiting (Design Ref: SVC-MENU-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:menu:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:menu:write');
  const deleteLimiter = createRateLimiter(10, 300, 'rl:menu:delete');

  // FR-MENU.2: 메뉴 검색
  app.get('/menu/search', {
    schema: {
      description: '메뉴 검색',
      tags: ['menu'],
      querystring: { type: 'object' as const, properties: { q: { type: 'string' as const, minLength: 1 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, searchMenuHandler as never);

  // FR-MENU.5: 메뉴 통계
  app.get('/menu/stats', {
    schema: { description: '메뉴 통계 조회', tags: ['menu'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, menuStatsHandler as never);

  // FR-P05.1: 메뉴 트리 조회
  app.get('/menu/tree', {
    schema: { description: '메뉴 트리 조회', tags: ['menu'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getMenuTreeHandler as never);

  // FR-P05.2: 역할별 메뉴 필터링
  app.get('/menu/filtered', {
    schema: {
      description: '역할별 메뉴 필터링',
      tags: ['menu'],
      querystring: { type: 'object' as const, properties: { role: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, getFilteredMenuHandler as never);

  // FR-P05.1: 메뉴 생성
  app.post('/menu', {
    schema: {
      description: '메뉴 생성',
      tags: ['menu'],
      body: {
        type: 'object' as const,
        required: ['name', 'path'],
        properties: {
          name: { type: 'string' as const, minLength: 1 },
          path: { type: 'string' as const },
          parentId: { type: 'string' as const },
          icon: { type: 'string' as const },
          order: { type: 'integer' as const },
          roles: { type: 'array' as const, items: { type: 'string' as const } },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createMenuHandler as never);

  // FR-P05.1: 메뉴 수정
  app.put('/menu/:id', {
    schema: {
      description: '메뉴 수정',
      tags: ['menu'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, path: { type: 'string' as const }, icon: { type: 'string' as const }, roles: { type: 'array' as const, items: { type: 'string' as const } } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updateMenuHandler as never);

  // FR-P05.1: 메뉴 삭제 + FR-MENU.3 감사 로그
  app.delete('/menu/:id', {
    schema: { description: '메뉴 삭제 (감사 로그 기록)', tags: ['menu'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: deleteLimiter,
  }, deleteMenuHandler as never);

  // FR-P05.3: 메뉴 순서 변경 + FR-MENU.4 테넌트 격리/감사
  app.put('/menu/:id/order', {
    schema: {
      description: '메뉴 순서 변경 (테넌트 격리, 감사 로그)',
      tags: ['menu'],
      params: idParam,
      body: { type: 'object' as const, required: ['order'], properties: { order: { type: 'integer' as const, minimum: 0 } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, reorderMenuHandler as never);
}
