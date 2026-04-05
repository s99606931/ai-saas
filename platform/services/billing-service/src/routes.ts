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
  app.get('/billing/invoices', listInvoicesHandler);
  app.get('/billing/invoices/:id', getInvoiceHandler);
  app.post('/billing/invoices/generate', generateInvoiceHandler);
  app.post('/billing/invoices/:id/pay', payInvoiceHandler);
  app.get('/billing/payments', listPaymentsHandler);
  app.post('/billing/invoices/:id/tax-invoice', generateTaxInvoiceHandler);
  app.get('/billing/dashboard', dashboardHandler);
}
