// AI 분석 핸들러
// Design Ref: SVC-AI-R2 DESIGN
// Plan SC: FR-AI.4, FR-AI.5
// CSAP: D-08-05 테넌트 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  tenantId: z.string().optional(),
});

/**
 * FR-AI.4: 일별 AI 사용량 추이
 * GET /ai/analytics/trend?days=7&tenantId={id}
 * Design Ref: SVC-AI-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function aiUsageTrendHandler(
  request: FastifyRequest<{ Querystring: { days?: string; tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = trendQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days, tenantId } = parseResult.data;

  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;
  const effectiveTenantId = jwtRole === 'SUPER_ADMIN' ? tenantId : (jwtTenantId ?? tenantId);

  const baseWhere: Record<string, unknown> = {};
  if (effectiveTenantId) baseWhere['tenantId'] = effectiveTenantId;

  const trend: { date: string; tokens: number; cost: number; calls: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const result = await prisma.aiUsage.aggregate({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lt: end },
      },
      _sum: { tokens: true, cost: true },
      _count: true,
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      tokens: result._sum.tokens ?? 0,
      cost: Number(result._sum.cost ?? 0),
      calls: result._count,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      summary: {
        totalTokens: trend.reduce((sum, t) => sum + t.tokens, 0),
        totalCost: trend.reduce((sum, t) => sum + t.cost, 0),
        totalCalls: trend.reduce((sum, t) => sum + t.calls, 0),
      },
      days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-AI.5: 모델별 사용 분석
 * GET /ai/analytics/models
 * Design Ref: SVC-AI-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function modelAnalyticsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['tenantId'] = jwtTenantId;
  }

  const modelStats = await prisma.aiUsage.groupBy({
    by: ['modelId'],
    where,
    _sum: { tokens: true, cost: true },
    _count: { id: true },
    _avg: { tokens: true },
    orderBy: { _count: { id: 'desc' } },
    take: 50,
  });

  // 등급별 집계
  const gradeStats = await prisma.aiUsage.groupBy({
    by: ['grade'],
    where,
    _count: { id: true },
    _sum: { tokens: true },
  });

  const totalCalls = modelStats.reduce((sum, m) => sum + m._count.id, 0);

  await reply.send({
    success: true,
    data: {
      models: modelStats.map((m) => ({
        modelId: m.modelId,
        callCount: m._count.id,
        totalTokens: m._sum.tokens ?? 0,
        totalCost: Number(m._sum.cost ?? 0),
        avgTokensPerCall: Math.round(Number(m._avg.tokens ?? 0)),
        callSharePercent: totalCalls > 0 ? Number(((m._count.id / totalCalls) * 100).toFixed(1)) : 0,
      })),
      gradeDistribution: gradeStats.map((g) => ({
        grade: g.grade,
        callCount: g._count.id,
        totalTokens: g._sum.tokens ?? 0,
      })),
      totalCalls,
      generatedAt: new Date().toISOString(),
    },
  });
}
