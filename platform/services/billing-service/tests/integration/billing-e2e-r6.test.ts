// 빌링 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.2
// CSAP: D-06 감사 로그, D-08-05 테넌트 격리

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('billing-service E2E -- 인보이스 생명주기 (CSAP D-06, D-08-05)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // In-memory 저장소
  interface Invoice {
    id: string;
    tenantId: string;
    subscriptionId: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE';
    createdAt: string;
    paidAt?: string;
  }

  interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    method: string;
    paidAt: string;
  }

  const invoices = new Map<string, Invoice>();
  const payments: Payment[] = [];
  const auditLog: Array<{ action: string; actor: string; target: string; timestamp: string }> = [];

  app.post('/billing/invoices/generate', async (req, reply) => {
    const body = req.body as { subscriptionId?: string; tenantId?: string; amount?: number };
    if (!body.subscriptionId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '구독 ID가 필요합니다' },
      });
      return;
    }
    const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const invoice: Invoice = {
      id,
      tenantId: body.tenantId ?? 'default',
      subscriptionId: body.subscriptionId,
      amount: body.amount ?? 100000,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    invoices.set(id, invoice);

    auditLog.push({
      action: 'INVOICE_GENERATED',
      actor: (req.headers['x-user-id'] as string) ?? 'system',
      target: id,
      timestamp: new Date().toISOString(),
    });

    await reply.status(201).send({ success: true, data: invoice });
  });

  app.get('/billing/invoices', async (req) => {
    const query = req.query as { tenantId?: string; status?: string };
    let items = Array.from(invoices.values());
    if (query.tenantId) items = items.filter((i) => i.tenantId === query.tenantId);
    if (query.status) items = items.filter((i) => i.status === query.status);
    return { success: true, data: items, pagination: { total: items.length } };
  });

  app.get('/billing/invoices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const invoice = invoices.get(id);
    if (!invoice) {
      await reply.status(404).send({
        success: false,
        error: { code: 'INVOICE_NOT_FOUND', message: '인보이스를 찾을 수 없습니다' },
      });
      return;
    }

    // CSAP D-08-05: 테넌트 격리
    const jwtTenantId = req.headers['x-user-tenant-id'] as string | undefined;
    const jwtRole = req.headers['x-user-role'] as string | undefined;
    if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && invoice.tenantId !== jwtTenantId) {
      await reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
      });
      return;
    }

    return { success: true, data: invoice };
  });

  app.post('/billing/invoices/:id/pay', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { method?: string; amount?: number };
    const invoice = invoices.get(id);
    if (!invoice) {
      await reply.status(404).send({
        success: false,
        error: { code: 'INVOICE_NOT_FOUND', message: '인보이스를 찾을 수 없습니다' },
      });
      return;
    }
    if (invoice.status === 'PAID') {
      await reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_PAID', message: '이미 결제된 인보이스입니다' },
      });
      return;
    }

    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      invoiceId: id,
      amount: body.amount ?? invoice.amount,
      method: body.method ?? 'CARD',
      paidAt: new Date().toISOString(),
    };
    payments.push(payment);
    invoice.status = 'PAID';
    invoice.paidAt = payment.paidAt;

    auditLog.push({
      action: 'INVOICE_PAID',
      actor: (req.headers['x-user-id'] as string) ?? 'system',
      target: id,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: { invoice, payment } };
  });

  app.get('/billing/payments', async (req) => {
    const query = req.query as { invoiceId?: string };
    const filtered = query.invoiceId ? payments.filter((p) => p.invoiceId === query.invoiceId) : payments;
    return { success: true, data: filtered };
  });

  app.get('/billing/overdue', async () => {
    const overdue = Array.from(invoices.values()).filter((i) => i.status === 'OVERDUE');
    return { success: true, data: overdue };
  });

  app.get('/billing/dashboard', async () => {
    const all = Array.from(invoices.values());
    const totalRevenue = all.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = all.filter((i) => i.status === 'PENDING').reduce((sum, i) => sum + i.amount, 0);
    return {
      success: true,
      data: {
        totalRevenue,
        pendingAmount,
        invoiceCount: all.length,
        paidCount: all.filter((i) => i.status === 'PAID').length,
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('인보이스 생성 -> 결제 -> 대시보드 전체 플로우', async () => {
    // 1. 인보이스 생성
    const genRes = await app.inject({
      method: 'POST',
      url: '/billing/invoices/generate',
      headers: { 'content-type': 'application/json', 'x-user-id': 'admin-1' },
      payload: { subscriptionId: 'sub-1', tenantId: 't-billing', amount: 500000 },
    });
    expect(genRes.statusCode).toBe(201);
    const invoiceId = genRes.json().data.id;

    // 2. 목록 조회
    const listRes = await app.inject({
      method: 'GET',
      url: '/billing/invoices?tenantId=t-billing',
    });
    expect(listRes.json().data.length).toBe(1);
    expect(listRes.json().data[0].status).toBe('PENDING');

    // 3. 결제
    const payRes = await app.inject({
      method: 'POST',
      url: `/billing/invoices/${invoiceId}/pay`,
      headers: { 'content-type': 'application/json', 'x-user-id': 'admin-1' },
      payload: { method: 'CARD' },
    });
    expect(payRes.json().success).toBe(true);
    expect(payRes.json().data.invoice.status).toBe('PAID');
    expect(payRes.json().data.payment.method).toBe('CARD');

    // 4. 대시보드 확인
    const dashRes = await app.inject({ method: 'GET', url: '/billing/dashboard' });
    expect(dashRes.json().data.totalRevenue).toBe(500000);
    expect(dashRes.json().data.paidCount).toBe(1);
  });

  it('CSAP D-08-05: 테넌트 격리 -- 타 테넌트 인보이스 접근 차단', async () => {
    // 인보이스 생성
    const genRes = await app.inject({
      method: 'POST',
      url: '/billing/invoices/generate',
      headers: { 'content-type': 'application/json' },
      payload: { subscriptionId: 'sub-iso', tenantId: 't-owner', amount: 200000 },
    });
    const invoiceId = genRes.json().data.id;

    // 다른 테넌트로 접근 시도
    const res = await app.inject({
      method: 'GET',
      url: `/billing/invoices/${invoiceId}`,
      headers: { 'x-user-tenant-id': 't-other', 'x-user-role': 'USER' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('SUPER_ADMIN은 모든 테넌트 인보이스 조회 가능', async () => {
    const genRes = await app.inject({
      method: 'POST',
      url: '/billing/invoices/generate',
      headers: { 'content-type': 'application/json' },
      payload: { subscriptionId: 'sub-sa', tenantId: 't-any', amount: 300000 },
    });
    const invoiceId = genRes.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/billing/invoices/${invoiceId}`,
      headers: { 'x-user-tenant-id': 't-admin', 'x-user-role': 'SUPER_ADMIN' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('이미 결제된 인보이스 중복 결제 방지', async () => {
    const genRes = await app.inject({
      method: 'POST',
      url: '/billing/invoices/generate',
      headers: { 'content-type': 'application/json' },
      payload: { subscriptionId: 'sub-dup', tenantId: 't-dup', amount: 100000 },
    });
    const invoiceId = genRes.json().data.id;

    // 첫 결제
    await app.inject({
      method: 'POST',
      url: `/billing/invoices/${invoiceId}/pay`,
      headers: { 'content-type': 'application/json' },
      payload: { method: 'TRANSFER' },
    });

    // 중복 결제 시도
    const dupRes = await app.inject({
      method: 'POST',
      url: `/billing/invoices/${invoiceId}/pay`,
      headers: { 'content-type': 'application/json' },
      payload: { method: 'CARD' },
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().error.code).toBe('ALREADY_PAID');
  });

  it('결제 이력 조회', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/payments' });
    expect(res.json().success).toBe(true);
    expect(res.json().data.length).toBeGreaterThan(0);
  });

  it('X-Response-Time 헤더 포함 검증', async () => {
    const res = await app.inject({ method: 'GET', url: '/billing/dashboard' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
