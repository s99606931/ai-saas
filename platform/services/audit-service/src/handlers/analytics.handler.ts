// 감사 로그 분석/집계 핸들러
// Design Ref: SVC-AUDIT-R1 DESIGN §1, §2
// Plan SC: FR-AUDIT.1, FR-AUDIT.2
// CSAP: D-06 감사 로그 — 이벤트 분석 및 통계

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const analyticsQuerySchema = z.object({
  tenantId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  groupBy: z.enum(['action', 'targetType', 'tenantId']).default('action'),
});

const topNQuerySchema = z.object({
  tenantId: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * FR-AUDIT.1: 감사 이벤트 집계
 * GET /audit/analytics
 *
 * 지정 필드별 이벤트 수를 집계합니다.
 */
export async function analyticsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = analyticsQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, fromDate, toDate, groupBy } = parseResult.data;

  const where: Record<string, unknown> = {};
  if (tenantId) where['tenantId'] = tenantId;
  if (fromDate || toDate) {
    where['createdAt'] = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  const groups = await prisma.auditLog.groupBy({
    by: [groupBy],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 100,
  });

  await reply.send({
    success: true,
    data: {
      groupBy,
      totalGroups: groups.length,
      groups: groups.map((g) => ({
        value: g[groupBy] ?? 'unknown',
        count: g._count.id,
      })),
    },
  });
}

/**
 * FR-AUDIT.2: 행위자별 Top-N
 * GET /audit/analytics/top-actors
 */
export async function topActorsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = topNQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, fromDate, toDate, limit } = parseResult.data;

  const where: Record<string, unknown> = {};
  if (tenantId) where['tenantId'] = tenantId;
  if (fromDate || toDate) {
    where['createdAt'] = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  const topActors = await prisma.auditLog.groupBy({
    by: ['actorId'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  await reply.send({
    success: true,
    data: topActors.map((a) => ({
      actorId: a.actorId ?? 'system',
      eventCount: a._count.id,
    })),
  });
}

/**
 * FR-AUDIT.2: 행위별 Top-N
 * GET /audit/analytics/top-actions
 */
export async function topActionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parseResult = topNQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { tenantId, fromDate, toDate, limit } = parseResult.data;

  const where: Record<string, unknown> = {};
  if (tenantId) where['tenantId'] = tenantId;
  if (fromDate || toDate) {
    where['createdAt'] = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    };
  }

  const topActions = await prisma.auditLog.groupBy({
    by: ['action'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });

  await reply.send({
    success: true,
    data: topActions.map((a) => ({
      action: a.action,
      eventCount: a._count.id,
    })),
  });
}
