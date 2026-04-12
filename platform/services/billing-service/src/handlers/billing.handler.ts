// 빌링 핸들러
// Design Ref: DESIGN-MTU-P08, SVC-BILLR2-R55.design.md §4
// Plan SC: FR-P08.1~FR-P08.5, FR-BILLR2.2
// CSAP: D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logBillingEvent } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { problemReply, BillingProblemTypes } from '../lib/problem-reply.js';

/**
 * 인보이스 목록 조회
 * Plan SC: FR-P08.1
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN 제외 본인 테넌트 인보이스만 조회
 * Security Ref: FR-N08.4
 */
export async function listInvoicesHandler(
  request: FastifyRequest<{
    Querystring: { subscriptionId?: string; status?: string; page?: string; pageSize?: string };
  }>,
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
    await problemReply(request, reply, {
      type: BillingProblemTypes.invoiceNotFound,
      title: 'Invoice Not Found',
      status: 404,
      detail: '인보이스를 찾을 수 없습니다',
    });
    return;
  }

  // CSAP D-08-05: 테넌트 격리 (Security Ref: FR-N08.4)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && invoice.subscription.tenantId !== jwtTenantId) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.forbidden,
      title: 'Forbidden',
      status: 403,
      detail: '접근 권한이 없습니다',
    });
    return;
  }

  await reply.send({ success: true, data: invoice });
}

/**
 * 인보이스 자동 생성 (구독 기반)
 * Plan SC: FR-P08.1
 */
export async function generateInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const schema = z.object({ subscriptionId: z.string().min(1) });
  const parseResult = schema.safeParse(request.body);
  if (!parseResult.success) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.validation,
      title: 'Validation Error',
      status: 400,
      detail: '구독 ID가 필요합니다',
    });
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: parseResult.data.subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.subscriptionNotFound,
      title: 'Subscription Not Found',
      status: 404,
      detail: '구독을 찾을 수 없습니다',
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
    await problemReply(request, reply, {
      type: BillingProblemTypes.validation,
      title: 'Validation Error',
      status: 400,
      detail: parseResult.error.issues.map((i) => i.message).join(', '),
    });
    return;
  }

  // CSAP D-08-05: 결제 전 인보이스 소유 테넌트 확인 (Security Ref: FR-N08.4)
  const invoiceCheck = await prisma.invoice.findUnique({
    where: { id: request.params.id },
    include: { subscription: { select: { tenantId: true } } },
  });
  if (!invoiceCheck) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.invoiceNotFound,
      title: 'Invoice Not Found',
      status: 404,
      detail: '인보이스를 찾을 수 없습니다',
    });
    return;
  }
  const payJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const payJwtRole = request.headers['x-user-role'] as string | undefined;
  if (payJwtRole !== 'SUPER_ADMIN' && payJwtTenantId && invoiceCheck.subscription.tenantId !== payJwtTenantId) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.forbidden,
      title: 'Forbidden',
      status: 403,
      detail: '접근 권한이 없습니다',
    });
    return;
  }

  // H-02 수정 (TOCTOU 경쟁조건): 트랜잭션으로 원자적 처리
  // - invoiceCheck 조회~payment 생성 사이 중복 결제 요청이 들어올 수 있음
  // - $transaction 내에서 최신 상태 재확인 후 처리
  const paidAt = new Date();
  const payment = await prisma.$transaction(async (tx) => {
    const latestInvoice = await tx.invoice.findUnique({
      where: { id: request.params.id },
      select: { status: true },
    });
    if (!latestInvoice || latestInvoice.status === 'paid') {
      return null;
    }

    const created = await tx.payment.create({
      data: {
        invoiceId: request.params.id,
        amount: parseResult.data.amount,
        method: parseResult.data.method,
        status: 'completed',
        paidAt,
      },
    });

    await tx.invoice.update({
      where: { id: request.params.id },
      data: { status: 'paid', paidAt },
    });

    return created;
  });

  if (!payment) {
    await problemReply(request, reply, {
      type: BillingProblemTypes.alreadyPaid,
      title: 'Already Paid',
      status: 409,
      detail: '이미 결제된 인보이스입니다',
    });
    return;
  }

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
 * Plan SC: FR-P08.2, FR-BILL.5
 * CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-BILL-R1 DESIGN)
 */
export async function listPaymentsHandler(
  request: FastifyRequest<{ Querystring: { invoiceId?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  // FR-BILL.5: 테넌트 격리 (CSAP D-08-05, Design Ref: SVC-BILL-R1 DESIGN)
  const payListJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const payListJwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (request.query.invoiceId) where['invoiceId'] = request.query.invoiceId;

  // SUPER_ADMIN이 아닌 경우 본인 테넌트 인보이스의 결제만 조회
  if (payListJwtRole !== 'SUPER_ADMIN' && payListJwtTenantId) {
    where['invoice'] = { is: { subscription: { is: { tenantId: payListJwtTenantId } } } };
  }

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
    await problemReply(request, reply, {
      type: BillingProblemTypes.invoiceNotFound,
      title: 'Invoice Not Found',
      status: 404,
      detail: '인보이스를 찾을 수 없습니다',
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

  // FR-BILL.4: 세금계산서 생성 감사 로그 (CSAP D-06, Design Ref: SVC-BILL-R1 DESIGN)
  const taxActor = (request.headers['x-user-id'] as string) || 'system';
  await logBillingEvent(
    'TAX_INVOICE_GENERATED',
    taxActor,
    invoice.id,
    invoice.subscription.tenantId,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { amount: taxInvoice.amount, total: taxInvoice.total },
  );

  await reply.send({ success: true, data: taxInvoice });
}

/**
 * 수익 대시보드 데이터
 * Plan SC: FR-P08.4
 * CSAP D-08-05: 테넌트 격리
 */
export async function dashboardHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-BILL-R1 DESIGN)
  const dashJwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const dashJwtRole = request.headers['x-user-role'] as string | undefined;

  const invoiceWhere: Record<string, unknown> = {};
  const paymentWhere: Record<string, unknown> = {};

  if (dashJwtRole !== 'SUPER_ADMIN' && dashJwtTenantId) {
    invoiceWhere['subscription'] = { is: { tenantId: dashJwtTenantId } };
    paymentWhere['invoice'] = { is: { subscription: { is: { tenantId: dashJwtTenantId } } } };
  }

  const [totalRevenue, invoiceCount, paidCount, pendingCount] = await Promise.all([
    prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.invoice.count({ where: { ...invoiceWhere, status: 'paid' } }),
    prisma.invoice.count({ where: { ...invoiceWhere, status: 'issued' } }),
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
