// 빌링 서비스 라우트
// Design Ref: DESIGN-MTU-P08, SVC-BILL-R1 DESIGN
// Plan SC: FR-P08.1~FR-P08.5, FR-BILL.1~FR-BILL.5

import type { FastifyInstance } from 'fastify';
import {
  listInvoicesHandler,
  getInvoiceHandler,
  generateInvoiceHandler,
  payInvoiceHandler,
  listPaymentsHandler,
  generateTaxInvoiceHandler,
  dashboardHandler,
} from './handlers/billing.handler.js';
import { overdueInvoicesHandler, revenueTrendHandler } from './handlers/billing-stats.handler.js';
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
  },
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

  // FR-BILL.1: Rate Limiting
  const readLimiter = createRateLimiter(100, 60, 'rl:billing:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:billing:write');

  // 정적 경로 우선 등록
  // FR-BILL.2: 연체 인보이스
  app.get('/billing/overdue', {
    schema: {
      description: '연체 인보이스 목록 조회',
      tags: ['billing'],
      querystring: paginationQuery,
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, overdueInvoicesHandler as never);

  // FR-BILL.3: 수익 추이
  app.get('/billing/revenue-trend', {
    schema: {
      description: '수익 추이 조회',
      tags: ['billing'],
      querystring: {
        type: 'object' as const,
        properties: { months: { type: 'integer' as const, minimum: 1, maximum: 24, default: 6 } },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, revenueTrendHandler as never);

  // FR-P08.4: 수익 대시보드
  app.get('/billing/dashboard', {
    schema: {
      description: '수익 대시보드 통계',
      tags: ['billing'],
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, dashboardHandler as never);

  // FR-P08.2 + FR-BILL.5: 결제 이력 (테넌트 격리)
  app.get('/billing/payments', {
    schema: {
      description: '결제 이력 조회 (테넌트 격리)',
      tags: ['billing'],
      querystring: paginationQuery,
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, listPaymentsHandler as never);

  // FR-P08.1: 인보이스 목록
  app.get('/billing/invoices', {
    schema: {
      description: '인보이스 목록 조회',
      tags: ['billing'],
      querystring: paginationQuery,
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, listInvoicesHandler as never);

  // FR-P08.1: 인보이스 생성
  app.post('/billing/invoices/generate', {
    schema: {
      description: '인보이스 생성',
      tags: ['billing'],
      body: {
        type: 'object' as const,
        required: ['tenantId', 'periodStart', 'periodEnd'],
        properties: {
          tenantId: { type: 'string' as const },
          periodStart: { type: 'string' as const, format: 'date' },
          periodEnd: { type: 'string' as const, format: 'date' },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, generateInvoiceHandler as never);

  // FR-P08.1: 인보이스 상세
  app.get('/billing/invoices/:id', {
    schema: {
      description: '인보이스 상세 조회',
      tags: ['billing'],
      params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, getInvoiceHandler as never);

  // FR-P08.2: 결제 처리
  app.post('/billing/invoices/:id/pay', {
    schema: {
      description: '인보이스 결제 처리',
      tags: ['billing'],
      params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string' as const } } },
      body: {
        type: 'object' as const,
        required: ['method'],
        properties: { method: { type: 'string' as const, enum: ['card', 'transfer', 'virtual_account'] } },
      },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, payInvoiceHandler as never);

  // FR-P08.3 + FR-BILL.4: 세금계산서 (감사 로그 포함)
  app.post('/billing/invoices/:id/tax-invoice', {
    schema: {
      description: '세금계산서 발행 (감사 로그 포함)',
      tags: ['billing'],
      params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, generateTaxInvoiceHandler as never);
}
