// 알림 핸들러
// Design Ref: DESIGN-MTU-P11
// Plan SC: FR-P11.1~FR-P11.5

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logNotificationEvent } from '../lib/audit.js';

const prisma = new PrismaClient();

// NOTE: 알림 템플릿은 Notification 모델의 subject/body 패턴 사용
// 별도 Template 모델은 Phase P5에서 추가 예정

const sendNotificationSchema = z.object({
  tenantId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  channel: z.enum(['email', 'in-app', 'sms']),
  subject: z.string().min(1, '제목은 필수입니다').max(200),
  body: z.string().min(1),
});

/**
 * 알림 발송
 * Plan SC: FR-P11.2
 */
export async function sendNotificationHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = sendNotificationSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const notification = await prisma.notification.create({
    data: {
      ...parseResult.data,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  // 감사 로그 (FR-P11.5, CSAP D-06)
  await logNotificationEvent(
    'NOTIFICATION_SENT',
    'system',
    notification.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { channel: parseResult.data.channel, userId: parseResult.data.userId },
  );

  await reply.status(201).send({ success: true, data: notification });
}

/**
 * 사용자 알림 조회
 * Plan SC: FR-P11.3
 */
export async function getUserNotificationsHandler(
  request: FastifyRequest<{ Params: { userId: string }; Querystring: { page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: request.params.userId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { userId: request.params.userId } }),
  ]);

  await reply.send({
    success: true,
    data: notifications,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

/**
 * 알림 읽음 처리
 * Plan SC: FR-P11.3
 */
export async function markReadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const notification = await prisma.notification.update({
    where: { id: request.params.id },
    data: { status: 'read' },
  });

  await reply.send({ success: true, data: notification });
}

/**
 * 발송 이력 조회
 * Plan SC: FR-P11.5
 */
export async function listHistoryHandler(
  request: FastifyRequest<{ Querystring: { channel?: string; status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const page = parseInt(request.query.page ?? '1', 10);
  const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100);
  const where: Record<string, unknown> = {};
  if (request.query.channel) where['channel'] = request.query.channel;
  if (request.query.status) where['status'] = request.query.status;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  await reply.send({
    success: true,
    data: notifications,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
