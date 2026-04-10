// 빌링 통계 및 연체 조회 핸들러
// Design Ref: SVC-BILL-R1 DESIGN
// Plan SC: FR-BILL.2, FR-BILL.3

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * FR-BILL.2: 연체 인보이스 조회
 * GET /billing/overdue
 * Design Ref: SVC-BILL-R1 DESIGN
 */
export async function overdueInvoicesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const now = new Date();

  // CSAP D-10: 방어 코딩 — 최대 500건
  const overdue = await prisma.invoice.findMany({
    where: {
      status: 'issued',
      dueDate: { lt: now },
    },
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
 */
export async function revenueTrendHandler(
  request: FastifyRequest<{ Querystring: { months?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const months = Math.min(parseInt(request.query.months ?? '6', 10), 24);
  const now = new Date();

  const trend: { month: string; revenue: number; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const end = new Date(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1);

    const monthKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

    const result = await prisma.payment.aggregate({
      where: {
        status: 'completed',
        paidAt: { gte: start, lt: end },
      },
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
