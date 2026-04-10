// 사용자 통계 핸들러
// Design Ref: SVC-USER-R2 DESIGN
// Plan SC: FR-USR.7, FR-USR.8
// CSAP: D-08-05 테넌트 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** 영구 비활성화 날짜 상수 */
const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');

/**
 * FR-USR.7: 사용자 통계
 * GET /users/stats
 * Design Ref: SVC-USER-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN은 전체, 그 외 본인 테넌트
 */
export async function userStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['tenantId'] = jwtTenantId;
  }

  const [
    totalUsers,
    roleDistribution,
    mfaEnabled,
    lockedUsers,
    deactivatedUsers,
    recentLogins,
  ] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
      where,
    }),
    prisma.user.count({ where: { ...where, mfaEnabled: true } }),
    prisma.user.count({
      where: {
        ...where,
        lockedUntil: { gt: new Date() },
        NOT: { lockedUntil: PERMANENT_LOCK },
      },
    }),
    prisma.user.count({
      where: { ...where, lockedUntil: PERMANENT_LOCK },
    }),
    prisma.user.count({
      where: {
        ...where,
        lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const mfaAdoptionRate = totalUsers > 0
    ? Math.round((mfaEnabled / totalUsers) * 100)
    : 0;

  await reply.send({
    success: true,
    data: {
      totalUsers,
      activeUsers: totalUsers - lockedUsers - deactivatedUsers,
      lockedUsers,
      deactivatedUsers,
      mfaEnabled,
      mfaAdoptionRate,
      recentLogins7d: recentLogins,
      roleDistribution: roleDistribution.map((r) => ({
        role: r.role,
        count: r._count.id,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-USR.8: 로그인 활동 추이 (최근 7일)
 * GET /users/login-activity
 * Design Ref: SVC-USER-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function loginActivityHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['tenantId'] = jwtTenantId;
  }

  const trend: { date: string; logins: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.auditLog.count({
      where: {
        ...where,
        action: 'LOGIN_SUCCESS',
        createdAt: { gte: start, lt: end },
      },
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      logins: count,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      totalLogins7d: trend.reduce((sum, t) => sum + t.logins, 0),
      generatedAt: new Date().toISOString(),
    },
  });
}
