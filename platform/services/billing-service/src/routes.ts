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
  app.get('/billing/overdue', { preHandler: readLimiter }, overdueInvoicesHandler as never);

  // FR-BILL.3: 수익 추이
  app.get('/billing/revenue-trend', { preHandler: readLimiter }, revenueTrendHandler as never);

  // FR-P08.4: 수익 대시보드
  app.get('/billing/dashboard', { preHandler: readLimiter }, dashboardHandler as never);

  // FR-P08.2 + FR-BILL.5: 결제 이력 (테넌트 격리)
  app.get('/billing/payments', { preHandler: readLimiter }, listPaymentsHandler as never);

  // FR-P08.1: 인보이스 목록
  app.get('/billing/invoices', { preHandler: readLimiter }, listInvoicesHandler as never);

  // FR-P08.1: 인보이스 생성
  app.post('/billing/invoices/generate', { preHandler: writeLimiter }, generateInvoiceHandler as never);

  // FR-P08.1: 인보이스 상세
  app.get('/billing/invoices/:id', { preHandler: readLimiter }, getInvoiceHandler as never);

  // FR-P08.2: 결제 처리
  app.post('/billing/invoices/:id/pay', { preHandler: writeLimiter }, payInvoiceHandler as never);

  // FR-P08.3 + FR-BILL.4: 세금계산서 (감사 로그 포함)
  app.post('/billing/invoices/:id/tax-invoice', { preHandler: writeLimiter }, generateTaxInvoiceHandler as never);
}
