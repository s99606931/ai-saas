// 빌링 통계 및 연체 조회 핸들러
// Design Ref: SVC-BILL-R1 DESIGN
// Plan SC: FR-BILL.2, FR-BILL.3
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const revenueTrendQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

/**
 * FR-BILL.2: 연체 인보이스 조회
 * GET /billing/overdue
 * Design Ref: SVC-BILL-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function overdueInvoicesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const now = new Date();

  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-BILL-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {
    status: 'issued',
    dueDate: { lt: now },
  };

  // SUPER_ADMIN이 아닌 경우 본인 테넌트 구독의 인보이스만 조회
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['subscription'] = { is: { tenantId: jwtTenantId } };
  }

  // CSAP D-10: 방어 코딩 -- 최대 500건
  const overdue = await prisma.invoice.findMany({
    where,
    include: {
      subscription: { select: { tenantId: true, tenant: { select: { name: true } } } },
    },
    orderBy: { dueDate: 'asc' },
    take: 500,
  });

  const totalOverdueAmount = overdue.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0,
  );

  await reply.send({
    success: true,
    data: {
      invoices: overdue,
      total: overdue.length,
      totalOverdueAmount: totalOverdueAmount.toString(),
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-BILL.3: 월별 수익 추이
 * GET /billing/revenue-trend?months=6
 * Design Ref: SVC-BILL-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 * CSAP D-12: Zod 입력 검증
 */
export async function revenueTrendHandler(
  request: FastifyRequest<{ Querystring: { months?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // C6-02: Zod 검증 (CSAP D-12)
  const parseResult = revenueTrendQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { months } = parseResult.data;

  const now = new Date();

  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-BILL-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const paymentWhere: Record<string, unknown> = { status: 'completed' };
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    paymentWhere['invoice'] = { is: { subscription: { is: { tenantId: jwtTenantId } } } };
  }

  const trend: { month: string; revenue: number; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const end = new Date(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1);

    const monthKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

    const monthWhere = {
      ...paymentWhere,
      paidAt: { gte: start, lt: end },
    };

    const result = await prisma.payment.aggregate({
      where: monthWhere,
      _sum: { amount: true },
      _count: { id: true },
    });

    trend.push({
      month: monthKey,
      revenue: Number(result._sum.amount ?? 0),
      count: result._count.id,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      totalRevenue: trend.reduce((sum, t) => sum + t.revenue, 0).toString(),
      months,
      generatedAt: new Date().toISOString(),
    },
  });
}
