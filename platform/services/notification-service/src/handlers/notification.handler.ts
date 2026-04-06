// 알림 핸들러
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2
// Plan SC: FR-P11.1~FR-P11.5
// CSAP: D-06 감사 로그, D-12 입력 검증

import type { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logNotificationEvent } from '../lib/audit.js';
import { sendWebhook } from '../lib/webhook-sender.js';
import { getTemplateByName, renderTemplate } from './template.handler.js';

const prisma = new PrismaClient();

const sendNotificationSchema = z.object({
  tenantId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  channel: z.enum(['email', 'in-app', 'sms', 'webhook']),
  subject: z.string().min(1, '제목은 필수입니다').max(200),
  body: z.string().min(1),
  webhookUrl: z.string().url().optional(), // 웹훅 채널 사용 시 필수
});

const sendFromTemplateSchema = z.object({
  templateName: z.string().min(1, '템플릿 이름은 필수입니다'),
  tenantId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  variables: z.record(z.string()).default({}),
  webhookUrl: z.string().url().optional(),
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

  const { webhookUrl, ...notificationData } = parseResult.data;

  // 웹훅 채널: 먼저 발송 후 결과 기록
  let webhookResult: { success: boolean; error?: string } | undefined;
  if (notificationData.channel === 'webhook') {
    if (!webhookUrl) {
      await reply.status(400).send({
        success: false,
        error: { code: 'WEBHOOK_URL_REQUIRED', message: '웹훅 채널 사용 시 webhookUrl은 필수입니다' },
      });
      return;
    }

    webhookResult = await sendWebhook(webhookUrl, {
      subject: notificationData.subject,
      body: notificationData.body,
      channel: 'webhook',
      sentAt: new Date().toISOString(),
    });
  }

  const notification = await prisma.notification.create({
    data: {
      ...notificationData,
      status: webhookResult ? (webhookResult.success ? 'sent' : 'failed') : 'sent',
      sentAt: new Date(),
    },
  });

  // 감사 로그 (FR-P11.5, CSAP D-06)
  const sendActor = (request.headers['x-user-id'] as string) || 'system';
  await logNotificationEvent(
    'NOTIFICATION_SENT',
    sendActor,
    notification.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    {
      channel: notificationData.channel,
      userId: notificationData.userId,
      webhookResult: webhookResult ? { success: webhookResult.success, error: webhookResult.error } : undefined,
    },
  );

  await reply.status(201).send({ success: true, data: notification });
}

/**
 * 템플릿 기반 알림 발송
 * Design Ref: DESIGN-MTU-Q2 §1
 * Plan SC: FR-P11.1
 */
export async function sendFromTemplateHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = sendFromTemplateSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const { templateName, tenantId, userId, variables, webhookUrl } = parseResult.data;

  const template = getTemplateByName(templateName);
  if (!template) {
    await reply.status(404).send({
      success: false,
      error: { code: 'TEMPLATE_NOT_FOUND', message: `활성 템플릿 '${templateName}'을 찾을 수 없습니다` },
    });
    return;
  }

  // Mustache 변수 치환
  const renderedSubject = renderTemplate(template.subject, variables);
  const renderedBody = renderTemplate(template.body, variables);

  // 웹훅 채널 발송
  let webhookResult: { success: boolean; error?: string } | undefined;
  if (template.channel === 'webhook') {
    if (!webhookUrl) {
      await reply.status(400).send({
        success: false,
        error: { code: 'WEBHOOK_URL_REQUIRED', message: '웹훅 템플릿 사용 시 webhookUrl은 필수입니다' },
      });
      return;
    }
    webhookResult = await sendWebhook(webhookUrl, {
      subject: renderedSubject,
      body: renderedBody,
      channel: 'webhook',
      sentAt: new Date().toISOString(),
    });
  }

  const notification = await prisma.notification.create({
    data: {
      tenantId: tenantId ?? null,
      userId: userId ?? null,
      channel: template.channel,
      subject: renderedSubject,
      body: renderedBody,
      status: webhookResult ? (webhookResult.success ? 'sent' : 'failed') : 'sent',
      sentAt: new Date(),
    },
  });

  const templateActor = (request.headers['x-user-id'] as string) || 'system';
  await logNotificationEvent(
    'NOTIFICATION_SENT_FROM_TEMPLATE',
    templateActor,
    notification.id,
    request.ip,
    request.headers['user-agent'] ?? 'unknown',
    { templateName, channel: template.channel, userId },
  );

  await reply.status(201).send({ success: true, data: notification });
}

/**
 * 사용자 알림 조회
 * Plan SC: FR-P11.3
 * CSAP D-08-05: 본인 알림만 조회 가능 (TENANT_ADMIN, SUPER_ADMIN 예외)
 */
export async function getUserNotificationsHandler(
  request: FastifyRequest<{ Params: { userId: string }; Querystring: { page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const callerId = request.headers['x-user-id'] as string | undefined;
  const callerRole = request.headers['x-user-role'] as string | undefined;
  const isAdmin = callerRole === 'SUPER_ADMIN' || callerRole === 'TENANT_ADMIN';

  // 인증되지 않은 요청 차단 (CSAP D-08: 접근 통제)
  if (!callerId) {
    await reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' },
    });
    return;
  }

  // 관리자가 아닌 경우 본인 알림만 조회 허용 (CSAP D-08-05)
  if (!isAdmin && callerId !== request.params.userId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '본인의 알림만 조회할 수 있습니다' },
    });
    return;
  }

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
 * CSAP D-08-05: 본인 알림만 읽음 처리 가능
 */
export async function markReadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const target = await prisma.notification.findUnique({
    where: { id: request.params.id },
    select: { id: true, userId: true },
  });

  if (!target) {
    await reply.status(404).send({
      success: false,
      error: { code: 'NOTIFICATION_NOT_FOUND', message: '알림을 찾을 수 없습니다' },
    });
    return;
  }

  const callerId = request.headers['x-user-id'] as string | undefined;
  const callerRole = request.headers['x-user-role'] as string | undefined;
  const isAdmin = callerRole === 'SUPER_ADMIN' || callerRole === 'TENANT_ADMIN';

  if (!isAdmin && callerId && callerId !== target.userId) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '본인의 알림만 읽음 처리할 수 있습니다' },
    });
    return;
  }

  const notification = await prisma.notification.update({
    where: { id: request.params.id },
    data: { status: 'read' },
  });

  await reply.send({ success: true, data: notification });
}

// 발송 이력 조회 쿼리 파라미터 검증 스키마 (CSAP D-12: 입력 검증)
const historyQuerySchema = z.object({
  channel: z.enum(['email', 'in-app', 'sms', 'webhook']).optional(),
  status: z.enum(['sent', 'failed', 'read', 'pending']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  pageSize: z.string().regex(/^\d+$/).optional(),
});

/**
 * 발송 이력 조회
 * Plan SC: FR-P11.5
 * CSAP D-12: channel, status 쿼리 파라미터 Zod enum 검증
 */
export async function listHistoryHandler(
  request: FastifyRequest<{ Querystring: { channel?: string; status?: string; page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const queryResult = historyQuerySchema.safeParse(request.query);
  if (!queryResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: queryResult.error.issues.map((i) => i.message).join(', ') },
    });
    return;
  }

  const page = parseInt(queryResult.data.page ?? '1', 10);
  const pageSize = Math.min(parseInt(queryResult.data.pageSize ?? '20', 10), 100);
  const where: Record<string, unknown> = {};
  if (queryResult.data.channel) where['channel'] = queryResult.data.channel;
  if (queryResult.data.status) where['status'] = queryResult.data.status;

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
