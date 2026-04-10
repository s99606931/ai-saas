// 보안 모니터링 분석 핸들러
// Design Ref: SVC-SECMON-R2 DESIGN
// Plan SC: FR-SECMON.6, FR-SECMON.7
// CSAP: D-06 침해사고 관리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

/**
 * FR-SECMON.6: 로그인 실패 추이
 * GET /security/login-failures/trend?days=7
 * Design Ref: SVC-SECMON-R2 DESIGN
 */
export async function loginFailureTrendHandler(
  request: FastifyRequest<{ Querystring: { days?: string } }>,
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
  const { days } = parseResult.data;

  const trend: { date: string; failures: number; uniqueIps: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const failures = await prisma.auditLog.count({
      where: {
        action: 'LOGIN_FAILED',
        createdAt: { gte: start, lt: end },
      },
    });

    // 고유 IP 수 (groupBy ip)
    const ips = await prisma.auditLog.groupBy({
      by: ['ip'],
      where: {
        action: 'LOGIN_FAILED',
        createdAt: { gte: start, lt: end },
      },
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      failures,
      uniqueIps: ips.length,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      totalFailures: trend.reduce((sum, t) => sum + t.failures, 0),
      days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-SECMON.7: 보안 이벤트 통계
 * GET /security/events/stats
 * Design Ref: SVC-SECMON-R2 DESIGN
 *
 * 감사 로그 기반 보안 이벤트 유형별 통계
 */
export async function securityEventStatsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const SECURITY_ACTIONS = [
    'LOGIN_FAILED', 'IP_BLOCKED', 'IP_UNBLOCKED',
    'AI_GRADE_VIOLATION', 'UNAUTHORIZED_ACCESS', 'SESSION_HIJACK_ATTEMPT',
  ];

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total24h, total7d, byAction] = await Promise.all([
    prisma.auditLog.count({
      where: { action: { in: SECURITY_ACTIONS }, createdAt: { gte: last24h } },
    }),
    prisma.auditLog.count({
      where: { action: { in: SECURITY_ACTIONS }, createdAt: { gte: last7d } },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { action: { in: SECURITY_ACTIONS }, createdAt: { gte: last7d } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ]);

  // IP 차단 이벤트 수 (최근 7일)
  const blockEvents = byAction.find((a) => a.action === 'IP_BLOCKED')?._count.id ?? 0;
  const unblockEvents = byAction.find((a) => a.action === 'IP_UNBLOCKED')?._count.id ?? 0;

  await reply.send({
    success: true,
    data: {
      total24h,
      total7d,
      blocklistActivity: {
        blocked7d: blockEvents,
        unblocked7d: unblockEvents,
        netChange: blockEvents - unblockEvents,
      },
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count.id,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
}
