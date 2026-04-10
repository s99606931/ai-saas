// 비활성 계정 감지 핸들러
// Design Ref: SVC-USER-R1 DESIGN §2
// Plan SC: FR-USR.2
// CSAP: D-08-10 계정 비활성화 관리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** 영구 비활성화 날짜 상수 */
const PERMANENT_LOCK = new Date('9999-12-31T23:59:59.000Z');

/** 기본 비활성 기준 일수 */
const DEFAULT_INACTIVE_DAYS = parseInt(process.env['INACTIVE_THRESHOLD_DAYS'] ?? '90', 10);

/**
 * 비활성 계정 목록 조회
 * Design Ref: SVC-USER-R1 DESIGN §2.2
 * Plan SC: FR-USR.2
 * CSAP D-08-10: 장기 미사용 계정 관리
 *
 * - lastLoginAt이 null(로그인 이력 없음) 또는 기준일보다 과거인 사용자
 * - 영구 비활성화(소프트 삭제)된 사용자는 제외
 * - SUPER_ADMIN: 전체 테넌트 조회 가능 + 테넌트별 통계
 */
export async function listInactiveUsersHandler(
  request: FastifyRequest<{
    Querystring: {
      days?: string;
      tenantId?: string;
      page?: string;
      pageSize?: string;
    };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const days = Math.max(1, parseInt(request.query.days ?? String(DEFAULT_INACTIVE_DAYS), 10));
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '50', 10), 100);

  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  // CSAP D-08-05: 테넌트 격리
  const tenantId = jwtRole === 'SUPER_ADMIN' ? (request.query.tenantId ?? jwtTenantId) : jwtTenantId;

  if (!tenantId) {
    await reply.status(400).send({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: '테넌트 ID가 필요합니다' },
    });
    return;
  }

  // 기준일 계산
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  // 비활성 사용자 조건: lastLoginAt이 null이거나 기준일보다 과거
  // 영구 비활성화(소프트 삭제)된 사용자는 제외
  const where = {
    tenantId,
    OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: thresholdDate } }],
    // 영구 비활성화 제외
    NOT: { lockedUntil: PERMANENT_LOCK },
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        tenantId: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { lastLoginAt: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  // 통계 집계
  const neverLoggedIn = await prisma.user.count({
    where: {
      tenantId,
      lastLoginAt: null,
      NOT: { lockedUntil: PERMANENT_LOCK },
    },
  });

  await reply.send({
    success: true,
    data: {
      users,
      summary: {
        totalInactive: total,
        neverLoggedIn,
        lastLoginOverThreshold: total - neverLoggedIn,
        thresholdDays: days,
      },
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
