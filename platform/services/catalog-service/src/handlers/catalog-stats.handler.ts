// 카탈로그 통계 및 카테고리 목록 핸들러
// Design Ref: SVC-CAT-R1 DESIGN
// Plan SC: FR-CAT.3, FR-CAT.5
// CSAP: D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * FR-CAT.3: 카테고리 목록
 * GET /catalog/categories
 * Design Ref: SVC-CAT-R1 DESIGN
 */
export async function listCategoriesHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const categories = await prisma.service.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' },
  });

  await reply.send({
    success: true,
    data: categories.map((c) => ({
      category: c.category,
      serviceCount: c._count.id,
    })),
    total: categories.length,
  });
}

/**
 * FR-CAT.5: 서비스 통계
 * GET /catalog/stats
 * Design Ref: SVC-CAT-R1 DESIGN
 */
export async function catalogStatsHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const [total, activeCount, categoryDistribution, flagCount] = await Promise.all([
    prisma.service.count(),
    prisma.service.count({ where: { isActive: true } }),
    prisma.service.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
    prisma.featureFlag.count(),
  ]);

  const inactiveCount = total - activeCount;

  await reply.send({
    success: true,
    data: {
      totalServices: total,
      activeServices: activeCount,
      inactiveServices: inactiveCount,
      activePercent: total > 0 ? Math.round((activeCount / total) * 100) : 0,
      totalFeatureFlags: flagCount,
      categoryDistribution: categoryDistribution.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
}
