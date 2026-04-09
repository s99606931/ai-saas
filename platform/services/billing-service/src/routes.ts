// 빌링 서비스 라우트
// Design Ref: DESIGN-MTU-P08
// Plan SC: FR-P08.1~FR-P08.5

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

  app.get('/billing/invoices', listInvoicesHandler);
  app.get('/billing/invoices/:id', getInvoiceHandler);
  app.post('/billing/invoices/generate', generateInvoiceHandler);
  app.post('/billing/invoices/:id/pay', payInvoiceHandler);
  app.get('/billing/payments', listPaymentsHandler);
  app.post('/billing/invoices/:id/tax-invoice', generateTaxInvoiceHandler);
  app.get('/billing/dashboard', dashboardHandler);
}
