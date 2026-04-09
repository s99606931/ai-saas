// 알림 통계 핸들러
// Design Ref: SVC-NOTIF-R1 DESIGN §5
// Plan SC: FR-NOTIF.5
// CSAP: D-08-05 테넌트 격리, D-06 감사 로그

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * 알림 통계 조회
 * Plan SC: FR-NOTIF.5
 * CSAP D-08-05: 테넌트 격리 — SUPER_ADMIN만 전체 통계 조회 가능
 *
 * 채널별 + 상태별 발송 수 집계
 */
export async function notificationStatsHandler(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  // 테넌트 격리
  const tenantId = jwtRole === 'SUPER_ADMIN'
    ? (request.query.tenantId ?? jwtTenantId)
    : jwtTenantId;

  const where: Record<string, unknown> = {};
  if (tenantId) {
    where['tenantId'] = tenantId;
  }

  // 채널별 집계
  const byChannel = await prisma.notification.groupBy({
    by: ['channel'],
    where,
    _count: true,
  });

  // 상태별 집계
  const byStatus = await prisma.notification.groupBy({
    by: ['status'],
    where,
    _count: true,
  });

  // 전체 건수
  const total = await prisma.notification.count({ where });

  await reply.send({
    success: true,
    data: {
      total,
      byChannel: byChannel.map((g) => ({
        channel: g.channel,
        count: g._count,
      })),
      byStatus: byStatus.map((g) => ({
        status: g.status,
        count: g._count,
      })),
    },
  });
}
