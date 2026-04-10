// 구독 통계 및 만료 임박 조회 핸들러
// Design Ref: SVC-SUB-R1 DESIGN
// Plan SC: FR-SUB.3, FR-SUB.4
// CSAP: D-08 테넌트 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * FR-SUB.3: 구독 만료 임박 조회
 * GET /subscription/expiring?days=7
 * Design Ref: SVC-SUB-R1 DESIGN
 */
export async function expiringSubscriptionsHandler(
  request: FastifyRequest<{ Querystring: { days?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const days = parseInt(request.query.days ?? '7', 10);
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  // CSAP D-10: 방어 코딩 — 최대 500건
  const expiring = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { gte: now, lte: threshold },
    },
    include: { plan: { select: { name: true, slug: true } } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: 500,
  });

  await reply.send({
    success: true,
    data: {
      subscriptions: expiring,
      total: expiring.length,
      thresholdDays: days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-SUB.4: 구독 통계
 * GET /subscription/stats
 * Design Ref: SVC-SUB-R1 DESIGN
 */
export async function subscriptionStatsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const [statusDistribution, planDistribution, totalPlans] = await Promise.all([
    prisma.subscription.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.subscription.groupBy({
      by: ['planId'],
      _count: { id: true },
      where: { status: 'ACTIVE' },
    }),
    prisma.plan.count(),
  ]);

  const totalSubscriptions = statusDistribution.reduce((sum, s) => sum + s._count.id, 0);
  const activeCount = statusDistribution.find((s) => s.status === 'ACTIVE')?._count.id ?? 0;

  await reply.send({
    success: true,
    data: {
      totalSubscriptions,
      activeSubscriptions: activeCount,
      totalPlans,
      statusDistribution: statusDistribution.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      planDistribution: planDistribution.map((p) => ({
        planId: p.planId,
        activeCount: p._count.id,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
}
