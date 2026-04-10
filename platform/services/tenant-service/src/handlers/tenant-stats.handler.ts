// 테넌트 통계 및 검색 핸들러
// Design Ref: SVC-TENANT-R2 DESIGN
// Plan SC: FR-TENANT.5, FR-TENANT.6
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const searchQuerySchema = z.object({
  q: z.string().min(1, '검색어는 필수입니다').max(200),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'status', 'maxUsers']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * FR-TENANT.5: 테넌트 검색
 * GET /tenants/search?q={keyword}&status={status}
 * Design Ref: SVC-TENANT-R2 DESIGN
 * CSAP D-12: Zod 입력 검증
 */
export async function searchTenantsHandler(
  request: FastifyRequest<{ Querystring: { q?: string; status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // C6-02: Zod 검증 (CSAP D-12)
  const parseResult = searchQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { q, status, page, pageSize } = parseResult.data;

  const where: Record<string, unknown> = {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ],
  };
  if (status) {
    where['status'] = status;
  }

  // CSAP D-10: 방어 코딩 — 최대 100건
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: { _count: { select: { users: true, subscriptions: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: tenants.map((t) => ({ ...t, maxStorage: t.maxStorage.toString() })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * FR-TENANT.6: 테넌트 통계
 * GET /tenants/stats
 * Design Ref: SVC-TENANT-R2 DESIGN
 */
export async function tenantStatsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const [statusDistribution, totalTenants, totalUsers, storageAgg] = await Promise.all([
    prisma.tenant.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.tenant.aggregate({
      _sum: { maxStorage: true },
    }),
  ]);

  const activeCount = statusDistribution.find((s) => s.status === 'ACTIVE')?._count.id ?? 0;
  const suspendedCount = statusDistribution.find((s) => s.status === 'SUSPENDED')?._count.id ?? 0;
  const trialCount = statusDistribution.find((s) => s.status === 'TRIAL')?._count.id ?? 0;
  const archivedCount = statusDistribution.find((s) => s.status === 'ARCHIVED')?._count.id ?? 0;

  await reply.send({
    success: true,
    data: {
      totalTenants,
      totalUsers,
      totalMaxStorageBytes: (storageAgg._sum.maxStorage ?? BigInt(0)).toString(),
      statusDistribution: {
        active: activeCount,
        suspended: suspendedCount,
        trial: trialCount,
        archived: archivedCount,
      },
      avgUsersPerTenant: totalTenants > 0 ? Math.round(totalUsers / totalTenants) : 0,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * 향상된 테넌트 목록 쿼리 파라미터 검증
 * 기존 listTenantsHandler에서 사용할 수 있는 유틸리티
 */
export { listQuerySchema };
