// 알림 전달률 및 템플릿 사용 분석 핸들러
// Design Ref: SVC-NOTIF-R2 DESIGN
// Plan SC: FR-NOTIF.6, FR-NOTIF.7
// CSAP: D-08-05 테넌트 격리

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// C6-02: Zod 검증 스키마 (CSAP D-12)
const deliveryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  channel: z.enum(['in_app', 'email', 'webhook', 'sms']).optional(),
});

/**
 * FR-NOTIF.6: 전달률 추이
 * GET /notification/analytics/delivery?days=7
 * Design Ref: SVC-NOTIF-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function deliveryRateHandler(
  request: FastifyRequest<{ Querystring: { days?: string; channel?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = deliveryQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }
  const { days, channel } = parseResult.data;

  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const baseWhere: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    baseWhere['tenantId'] = jwtTenantId;
  }
  if (channel) baseWhere['channel'] = channel;

  const trend: { date: string; sent: number; delivered: number; failed: number; deliveryRate: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const dateWhere = { ...baseWhere, createdAt: { gte: start, lt: end } };

    const [sent, delivered, failed] = await Promise.all([
      prisma.notification.count({ where: dateWhere }),
      prisma.notification.count({ where: { ...dateWhere, status: 'delivered' } }),
      prisma.notification.count({ where: { ...dateWhere, status: 'failed' } }),
    ]);

    trend.push({
      date: start.toISOString().slice(0, 10),
      sent,
      delivered,
      failed,
      deliveryRate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0,
    });
  }

  const totalSent = trend.reduce((sum, t) => sum + t.sent, 0);
  const totalDelivered = trend.reduce((sum, t) => sum + t.delivered, 0);

  await reply.send({
    success: true,
    data: {
      trend,
      summary: {
        totalSent,
        totalDelivered,
        totalFailed: trend.reduce((sum, t) => sum + t.failed, 0),
        overallDeliveryRate: totalSent > 0
          ? Number(((totalDelivered / totalSent) * 100).toFixed(1))
          : 0,
      },
      days,
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * FR-NOTIF.7: 채널별 전달 분석
 * GET /notification/analytics/channels
 * Design Ref: SVC-NOTIF-R2 DESIGN
 * CSAP D-08-05: 테넌트 격리
 */
export async function channelAnalyticsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-08-05: 테넌트 격리
  const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
  const jwtRole = request.headers['x-user-role'] as string | undefined;

  const where: Record<string, unknown> = {};
  if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
    where['tenantId'] = jwtTenantId;
  }

  // 채널별 전체/전달/실패 집계
  const channels = await prisma.notification.groupBy({
    by: ['channel'],
    where,
    _count: { id: true },
  });

  const channelStats: { channel: string; total: number; delivered: number; failed: number; deliveryRate: number }[] = [];

  for (const ch of channels) {
    const [delivered, failed] = await Promise.all([
      prisma.notification.count({ where: { ...where, channel: ch.channel, status: 'delivered' } }),
      prisma.notification.count({ where: { ...where, channel: ch.channel, status: 'failed' } }),
    ]);

    channelStats.push({
      channel: ch.channel,
      total: ch._count.id,
      delivered,
      failed,
      deliveryRate: ch._count.id > 0
        ? Number(((delivered / ch._count.id) * 100).toFixed(1))
        : 0,
    });
  }

  const totalAll = channelStats.reduce((sum: number, c) => sum + c.total, 0);

  await reply.send({
    success: true,
    data: {
      channels: channelStats.map((c) => ({
        ...c,
        sharePercent: totalAll > 0
          ? Number(((c.total / totalAll) * 100).toFixed(1))
          : 0,
      })),
      totalNotifications: totalAll,
      generatedAt: new Date().toISOString(),
    },
  });
}
