// 빌링 핸들러
// Design Ref: DESIGN-MTU-P08
// Plan SC: FR-P08.1~FR-P08.5
// CSAP: D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logBillingEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';

/**
 * 인보이스 목록 조회
 * Plan SC: FR-P08.1
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 본인 테넌트 인보이스만 조회
 * Security Ref: FR-N08.4
 */
export async function listInvoicesHandler(
  request: FastifyRequest<{ Querystring: { subscriptionId?: string; status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // CSAP D-08-05: JWT 클레임 기반 테넌트 격리 (Security Ref: FR-N08.4)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (request.query.subscriptionId) where['subscriptionId'] = request.query.subscriptionId;
  if (request.query.status) where['status'] = request.query.status;

  // SUPER_ADMIN이 아닌 경우 본인 테넌트 구독의 인보이스만 조회
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['subscription'] = { is: { tenantId: jwtTenantId } };
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { payments: true, subscription: { include: { tenant: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: invoices,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 인보이스 상세 조회
 * Plan SC: FR-P08.1
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 타 테넌트 인보이스 조회 차단
 * Security Ref: FR-N08.4
 */
export async function getInvoiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: request.params.id },
    include: { payments: true, subscription: { include: { tenant: true, plan: true } } },
  });

  if (!invoice) {
    await reply.status(404).send({
      success: false,
      error: { code: 'INVOICE_NOT_FOUND', message: '인보이스를 찾을 수 없습니다' },
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 (Security Ref: FR-N08.4)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && invoice.subscription.tenantId !== jwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  await reply.send({ success: true, data: invoice });
}

/**
 * 인보이스 자동 생성 (구독 기반)
 * Plan SC: FR-P08.1
 */
export async function generateInvoiceHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({ subscriptionId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '구독 ID가 필요합니다' },
    });
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: parseResult.data.subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    await reply.status(404).send({
      success: false,
      error: { code: 'SUBSCRIPTION_NOT_FOUND', message: '구독을 찾을 수 없습니다' },
    });
    return;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      amount: subscription.plan.price,
      currency: subscription.plan.currency,
      status: 'issued',
      issuedAt: new Date(),
      dueDate,
    },
  });

  // 감사 로그 (FR-P08.5, CSAP D-06)
  const invoiceActor = (request.headers['x-user-id'] as string) || 'system';
  await logBillingEvent(
    'INVOICE_GENERATED',
    invoiceActor,
    invoice.id,
    subscription.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { amount: invoice.amount.toString(), subscriptionId: subscription.id },
  );

  await reply.status(201).send({ success: true, data: invoice });
}

/**
 * 결제 처리
 * Plan SC: FR-P08.2
 * CSAP D-08-05: 테넌트 격리 — 본인 테넌트 인보이스만 결제 가능
 * Security Ref: FR-N08.4
 */
export async function payInvoiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const schema = z.object({
    amount: z.number().min(0),
    method: z.enum(['card', 'bank_transfer', 'virtual_account']),
  });

  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  // CSAP D-08-05: 결제 전 인보이스 소유 테넌트 확인 (Security Ref: FR-N08.4)
  const invoiceCheck = await prisma.invoice.findUnique({
    where: { id: request.params.id },
    include: { subscription: { select: { tenantId: true } } },
  });
  if (!invoiceCheck) {
    await reply.status(404).send({
      success: false,
      error: { code: 'INVOICE_NOT_FOUND', message: '인보이스를 찾을 수 없습니다' },
    });
    return;
  }
  const payJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const payJwtRole = request.headers['x-user-role'] as string | undefined;
  if (payJwtRole !== 'SUPER_ADMIN' && payJwtTenantId && invoiceCheck.subscription.tenantId !== payJwtTenantId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' },
    });
    return;
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: request.params.id,
      amount: parseResult.data.amount,
      method: parseResult.data.method,
      status: 'completed',
      paidAt: new Date(),
    },
  });

  await prisma.invoice.update({
    where: { id: request.params.id },
    data: { status: 'paid', paidAt: new Date() },
  });

  // 감사 로그 (FR-P08.5, CSAP D-06)
  const paymentActor = (request.headers['x-user-id'] as string) || 'system';
  const paymentTenantId = (request.headers['x-user-tenant-id'] as string) || 'system';
  await logBillingEvent(
    'PAYMENT_COMPLETED',
    paymentActor,
    payment.id,
    paymentTenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { invoiceId: request.params.id, amount: parseResult.data.amount, method: parseResult.data.method },
  );

  await reply.send({ success: true, data: payment });
}

/**
 * 결제 이력 조회
 * Plan SC: FR-P08.2
 */
export async function listPaymentsHandler(
  request: FastifyRequest<{ Querystring: { invoiceId?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const where = request.query.invoiceId ? { invoiceId: request.query.invoiceId } : {};

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: payments,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 세금계산서 생성 (공공기관)
 * Plan SC: FR-P08.3
 */
export async function generateTaxInvoiceHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: request.params.id },
    include: { subscription: { include: { tenant: true } } },
  });

  if (!invoice) {
    await reply.status(404).send({
      success: false,
      error: { code: 'INVOICE_NOT_FOUND', message: '인보이스를 찾을 수 없습니다' },
    });
    return;
  }

  // 세금계산서 데이터 생성 (실제 전자세금계산서 연동은 외부 서비스 연계 시)
  const taxInvoice = {
    invoiceId: invoice.id,
    tenantName: invoice.subscription.tenant.name,
    amount: invoice.amount.toString(),
    tax: (Number(invoice.amount) * 0.1).toFixed(2),
    total: (Number(invoice.amount) * 1.1).toFixed(2),
    issuedAt: new Date().toISOString(),
  };

  await reply.send({ success: true, data: taxInvoice });
}

/**
 * 수익 대시보드 데이터
 * Plan SC: FR-P08.4
 */
export async function dashboardHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const [totalRevenue, invoiceCount, paidCount, pendingCount] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: 'paid' } }),
    prisma.invoice.count({ where: { status: 'issued' } }),
  ]);

  await reply.send({
    success: true,
    data: {
      totalRevenue: totalRevenue._sum.amount?.toString() ?? '0',
      invoiceCount,
      paidCount,
      pendingCount,
    },
  });
}
