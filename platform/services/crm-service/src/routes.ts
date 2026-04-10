// CRM 서비스 라우트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  listCustomersHandler,
  getCustomerHandler,
  createCustomerHandler,
  updateCustomerHandler,
  listContactsHandler,
  createContactHandler,
  listContractsHandler,
  createContractHandler,
  updateContractHandler,
  pipelineHandler,
} from './handlers/crm.handler.js';
import { expiringContractsHandler, crmStatsHandler } from './handlers/crm-stats.handler.js';
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

  // CSAP D-08-06: Rate Limiting (읽기/쓰기 분리)
  const readLimiter = createRateLimiter(100, 60, 'rl:crm:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:crm:write');

  // FR-P09.1: 고객사 CRUD
  app.get('/crm/customers', {
    schema: { description: '고객사 목록 조회', tags: ['crm'], querystring: paginationQuery, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listCustomersHandler as never);
  app.get('/crm/customers/:id', {
    schema: { description: '고객사 상세 조회', tags: ['crm'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getCustomerHandler as never);
  app.post('/crm/customers', {
    schema: {
      description: '고객사 등록',
      tags: ['crm'],
      body: {
        type: 'object' as const,
        required: ['name'],
        properties: { name: { type: 'string' as const, minLength: 1 }, industry: { type: 'string' as const }, size: { type: 'string' as const } },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createCustomerHandler as never);
  app.put('/crm/customers/:id', {
    schema: {
      description: '고객사 수정',
      tags: ['crm'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, industry: { type: 'string' as const }, size: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updateCustomerHandler as never);

  // FR-P09.2: 담당자 CRUD
  app.get('/crm/customers/:id/contacts', {
    schema: { description: '고객사 담당자 목록 조회', tags: ['crm'], params: idParam, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listContactsHandler as never);
  app.post('/crm/customers/:id/contacts', {
    schema: {
      description: '고객사 담당자 등록',
      tags: ['crm'],
      params: idParam,
      body: {
        type: 'object' as const,
        required: ['name', 'email'],
        properties: { name: { type: 'string' as const }, email: { type: 'string' as const, format: 'email' }, phone: { type: 'string' as const }, role: { type: 'string' as const } },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createContactHandler as never);

  // FR-CRM.3: CRM 통계
  app.get('/crm/stats', {
    schema: { description: 'CRM 통계 대시보드', tags: ['crm'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, crmStatsHandler as never);

  // FR-CRM.2: 계약 만료 임박 (정적 경로 우선)
  app.get('/crm/contracts/expiring', {
    schema: {
      description: '만료 임박 계약 목록 조회',
      tags: ['crm'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 365, default: 30 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, expiringContractsHandler as never);

  // FR-P09.3 + FR-CRM.4: 계약 CRUD (테넌트 격리)
  app.get('/crm/contracts', {
    schema: { description: '계약 목록 조회 (테넌트 격리)', tags: ['crm'], querystring: paginationQuery, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listContractsHandler as never);
  app.post('/crm/contracts', {
    schema: {
      description: '계약 등록',
      tags: ['crm'],
      body: {
        type: 'object' as const,
        required: ['customerId', 'startDate', 'endDate'],
        properties: {
          customerId: { type: 'string' as const },
          startDate: { type: 'string' as const, format: 'date' },
          endDate: { type: 'string' as const, format: 'date' },
          amount: { type: 'number' as const },
          status: { type: 'string' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createContractHandler as never);
  app.put('/crm/contracts/:id', {
    schema: {
      description: '계약 수정',
      tags: ['crm'],
      params: idParam,
      body: { type: 'object' as const, properties: { startDate: { type: 'string' as const }, endDate: { type: 'string' as const }, amount: { type: 'number' as const }, status: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, updateContractHandler as never);

  // FR-P09.4 + FR-CRM.5: 영업 파이프라인 (테넌트 격리)
  app.get('/crm/pipeline', {
    schema: { description: '영업 파이프라인 조회 (테넌트 격리)', tags: ['crm'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, pipelineHandler as never);
}
