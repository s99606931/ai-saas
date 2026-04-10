// 구독 통계 및 만료 임박 조회 핸들러
// Design Ref: SVC-SUB-R1 DESIGN
// Plan SC: FR-SUB.3, FR-SUB.4
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

/**
 * FR-SUB.3: 구독 만료 임박 조회
 * GET /subscription/expiring?days=7
 * Design Ref: SVC-SUB-R1 DESIGN
 * CSAP D-08-05: 테넌트 격리
 * CSAP D-12: Zod 입력 검증
 */
export async function expiringSubscriptionsHandler(
  request: FastifyRequest<{ Querystring: { days?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // C6-02: Zod 검증 (CSAP D-12)
  const parseResult = expiringQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days } = parseResult.data;

  const now = new Date();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-SUB-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    currentPeriodEnd: { gte: now, lte: threshold },
  };

  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['tenantId'] = jwtTenantId;
  }

  // CSAP D-10: 방어 코딩 -- 최대 500건
  const expiring = await prisma.subscription.findMany({
    where,
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
 * CSAP D-08-05: 테넌트 격리
 */
export async function subscriptionStatsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-08-05: 테넌트 격리 (Design Ref: SVC-SUB-R1 DESIGN)
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const subWhere: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    subWhere['tenantId'] = jwtTenantId;
  }

  const [statusDistribution, planDistribution, totalPlans] = await Promise.all([
    prisma.subscription.groupBy({
      by: ['status'],
      _count: { id: true },
      where: subWhere,
    }),
    prisma.subscription.groupBy({
      by: ['planId'],
      _count: { id: true },
      where: { ...subWhere, status: 'ACTIVE' },
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
