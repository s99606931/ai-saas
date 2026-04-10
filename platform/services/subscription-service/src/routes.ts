// 구독 서비스 라우트
// Design Ref: DESIGN-MTU-P07, SVC-SUB-R1 DESIGN
// Plan SC: FR-P07.1~FR-P07.5, FR-SUB.1~FR-SUB.4

import type { FastifyInstance } from 'fastify';
import {
  listPlansHandler,
  createPlanHandler,
  updatePlanHandler,
  subscribeHandler,
  getTenantSubscriptionHandler,
  upgradeHandler,
  downgradeHandler,
  cancelHandler,
} from './handlers/subscription.handler.js';
import { expiringSubscriptionsHandler, subscriptionStatsHandler } from './handlers/subscription-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const, additionalProperties: true } },
} as const;

const errorResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const, additionalProperties: true } },
} as const;

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
} as const;

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
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

  // FR-SUB.1: Rate Limiting (Design Ref: SVC-SUB-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:sub:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:sub:write');
  const cancelLimiter = createRateLimiter(5, 300, 'rl:sub:cancel');

  // FR-SUB.3: 구독 만료 임박 조회
  app.get('/subscription/expiring', {
    schema: {
      description: '구독 만료 임박 조회',
      tags: ['subscription'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 365, default: 30 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, expiringSubscriptionsHandler as never);

  // FR-SUB.4: 구독 통계
  app.get('/subscription/stats', {
    schema: { description: '구독 통계 대시보드', tags: ['subscription'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, subscriptionStatsHandler as never);

  // FR-P07.1: 플랜 목록
  app.get('/subscription/plans', {
    schema: { description: '구독 플랜 목록 조회', tags: ['subscription'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listPlansHandler as never);

  // FR-P07.1 + FR-SUB.2: 플랜 생성 (감사 로그 포함)
  app.post('/subscription/plans', {
    schema: {
      description: '구독 플랜 생성 (감사 로그)',
      tags: ['subscription'],
      body: {
        type: 'object' as const,
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' as const, minLength: 1 },
          price: { type: 'number' as const, minimum: 0 },
          interval: { type: 'string' as const, enum: ['monthly', 'yearly'] },
          features: { type: 'array' as const, items: { type: 'string' as const } },
          maxUsers: { type: 'integer' as const, minimum: 1 },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createPlanHandler as never);

  // FR-P07.1 + FR-SUB.2: 플랜 수정 (감사 로그 포함)
  app.put('/subscription/plans/:id', {
    schema: {
      description: '구독 플랜 수정 (감사 로그)',
      tags: ['subscription'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, price: { type: 'number' as const }, features: { type: 'array' as const, items: { type: 'string' as const } } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updatePlanHandler as never);

  // FR-P07.2: 구독 생성
  app.post('/subscription/subscribe', {
    schema: {
      description: '구독 생성',
      tags: ['subscription'],
      body: { type: 'object' as const, required: ['tenantId', 'planId'], properties: { tenantId: { type: 'string' as const }, planId: { type: 'string' as const } } },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, subscribeHandler as never);

  // FR-P07.2: 테넌트 구독 조회
  app.get('/subscription/tenants/:tenantId', {
    schema: {
      description: '테넌트 구독 조회',
      tags: ['subscription'],
      params: { type: 'object' as const, required: ['tenantId'], properties: { tenantId: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, getTenantSubscriptionHandler as never);

  // FR-P07.4: 구독 업그레이드
  app.put('/subscription/:id/upgrade', {
    schema: {
      description: '구독 업그레이드',
      tags: ['subscription'],
      params: idParam,
      body: { type: 'object' as const, required: ['planId'], properties: { planId: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, upgradeHandler as never);

  // FR-P07.4: 구독 다운그레이드
  app.put('/subscription/:id/downgrade', {
    schema: {
      description: '구독 다운그레이드',
      tags: ['subscription'],
      params: idParam,
      body: { type: 'object' as const, required: ['planId'], properties: { planId: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, downgradeHandler as never);

  // FR-P07.2: 구독 취소
  app.post('/subscription/:id/cancel', {
    schema: {
      description: '구독 취소',
      tags: ['subscription'],
      params: idParam,
      body: { type: 'object' as const, properties: { reason: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: cancelLimiter,
  }, cancelHandler as never);
}
