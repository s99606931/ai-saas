// 보안 대시보드 및 위협 추이 핸들러
// Design Ref: SVC-SEC-R1 DESIGN
// Plan SC: FR-SEC.1, FR-SEC.4

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

const SECURITY_ACTIONS = [
  'LOGIN_FAILED',
  'IP_BLOCKED',
  'AI_GRADE_VIOLATION',
  'UNAUTHORIZED_ACCESS',
  'SESSION_HIJACK_ATTEMPT',
];

/**
 * FR-SEC.1: 보안 대시보드
 * GET /security/dashboard
 * Design Ref: SVC-SEC-R1 DESIGN
 */
export async function securityDashboardHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  const [totalAlerts, actionDistribution] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: { in: SECURITY_ACTIONS },
        createdAt: { gte: last24h },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        action: { in: SECURITY_ACTIONS },
        createdAt: { gte: last24h },
      },
      _count: { id: true },
    }),
  ]);

  // 심각도별 분류
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;

  for (const d of actionDistribution) {
    if (d.action === 'AI_GRADE_VIOLATION' || d.action === 'SESSION_HIJACK_ATTEMPT') {
      criticalCount += d._count.id;
    } else if (d.action === 'IP_BLOCKED' || d.action === 'UNAUTHORIZED_ACCESS') {
      highCount += d._count.id;
    } else {
      mediumCount += d._count.id;
    }
  }

  const severityDistribution = [
    { severity: 'critical', count: criticalCount },
    { severity: 'high', count: highCount },
    { severity: 'medium', count: mediumCount },
    { severity: 'low', count: 0 },
  ];

  await reply.send({
    success: true,
    data: {
      totalAlerts24h: totalAlerts,
      actionDistribution: actionDistribution.map((d) => ({
        action: d.action,
        count: d._count.id,
      })),
      severityDistribution,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-SEC.4: 위협 추이 (최근 7일)
 * GET /security/threat-trend
 * Design Ref: SVC-SEC-R1 DESIGN
 */
export async function threatTrendHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const trend: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.auditLog.count({
      where: {
        action: { in: SECURITY_ACTIONS },
        createdAt: { gte: start, lt: end },
      },
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      count,
    });
  }

  await reply.send({
    success: true,
    data: {
      trend,
      totalEvents: trend.reduce((sum, t) => sum + t.count, 0),
      generatedAt: new Date().toISOString(),
    },
  });
}
