// 알림 서비스 라우트
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2, SVC-NOTIF-R1 DESIGN
// Plan SC: FR-P11.1~FR-P11.5, FR-NOTIF.1~FR-NOTIF.5

import type { FastifyInstance } from 'fastify';
import {
  sendNotificationHandler,
  sendFromTemplateHandler,
  getUserNotificationsHandler,
  markReadHandler,
  listHistoryHandler,
  unreadCountHandler,
  markAllReadHandler,
} from './handlers/notification.handler.js';
import {
  createTemplateHandler,
  listTemplatesHandler,
  getTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
} from './handlers/template.handler.js';
import { notificationStatsHandler } from './handlers/stats.handler.js';
import { deliveryRateHandler, channelAnalyticsHandler } from './handlers/delivery-analytics.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const, additionalProperties: true } },
} as const;

const errorResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const, additionalProperties: true } },
} as const;

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
} as const;

const userIdParam = {
  type: 'object' as const, required: ['userId'] as const, properties: { userId: { type: 'string' as const } },
} as const;

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 서비스 수준 내부 인증 (CSAP D-08: 심층 방어)
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health' || request.url === '/ready') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
        return;
      }
    });
  }

  // FR-NOTIF.1: Rate Limiting (Design Ref: SVC-NOTIF-R1 DESIGN)
  const sendLimiter = createRateLimiter(20, 60, 'rl:notif:send');
  const readLimiter = createRateLimiter(100, 60, 'rl:notif:read');
  const templateLimiter = createRateLimiter(30, 60, 'rl:notif:template');

  // 알림 발송 (FR-P11.2, FR-P11.3)
  app.post('/notification/send', {
    schema: {
      description: '알림 발송',
      tags: ['notification'],
      body: {
        type: 'object' as const,
        required: ['userId', 'channel', 'title', 'body'],
        properties: {
          userId: { type: 'string' as const },
          channel: { type: 'string' as const, enum: ['email', 'sms', 'push', 'in-app'] },
          title: { type: 'string' as const, minLength: 1 },
          body: { type: 'string' as const, minLength: 1 },
          metadata: { type: 'object' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: sendLimiter,
  }, sendNotificationHandler as never);

  // 템플릿 기반 발송 (FR-P11.1)
  app.post('/notification/send-template', {
    schema: {
      description: '템플릿 기반 알림 발송',
      tags: ['notification'],
      body: {
        type: 'object' as const,
        required: ['userId', 'templateId'],
        properties: {
          userId: { type: 'string' as const },
          templateId: { type: 'string' as const },
          variables: { type: 'object' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: sendLimiter,
  }, sendFromTemplateHandler as never);

  // 사용자 알림 조회 (FR-P11.3)
  app.get('/notification/user/:userId', {
    schema: {
      description: '사용자 알림 목록 조회',
      tags: ['notification'],
      params: userIdParam,
      querystring: { type: 'object' as const, properties: { page: { type: 'integer' as const, minimum: 1, default: 1 }, limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, getUserNotificationsHandler as never);

  // FR-NOTIF.2: 읽지 않은 알림 카운트
  app.get('/notification/user/:userId/unread-count', {
    schema: { description: '읽지 않은 알림 수 조회', tags: ['notification'], params: userIdParam, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, unreadCountHandler as never);

  // FR-NOTIF.3: 일괄 읽음 처리
  app.put('/notification/user/:userId/read-all', {
    schema: { description: '알림 일괄 읽음 처리', tags: ['notification'], params: userIdParam, response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, markAllReadHandler as never);

  // 알림 읽음 처리 (FR-P11.3)
  app.put('/notification/:id/read', {
    schema: { description: '알림 읽음 처리', tags: ['notification'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, markReadHandler as never);

  // 발송 이력 (FR-P11.5, FR-NOTIF.4: 테넌트 격리 강화)
  app.get('/notification/history', {
    schema: {
      description: '알림 발송 이력 (테넌트 격리)',
      tags: ['notification'],
      querystring: { type: 'object' as const, properties: { page: { type: 'integer' as const, minimum: 1, default: 1 }, limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, listHistoryHandler as never);

  // FR-NOTIF.5: 알림 통계
  app.get('/notification/stats', {
    schema: { description: '알림 통계 조회', tags: ['notification'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, notificationStatsHandler as never);

  // FR-NOTIF.6: 전달률 추이
  app.get('/notification/analytics/delivery', {
    schema: {
      description: '알림 전달률 추이',
      tags: ['notification'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 365, default: 30 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, deliveryRateHandler as never);

  // FR-NOTIF.7: 채널별 전달 분석
  app.get('/notification/analytics/channels', {
    schema: { description: '채널별 알림 전달 분석', tags: ['notification'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, channelAnalyticsHandler as never);

  // 템플릿 CRUD (FR-P11.1)
  app.post('/notification/templates', {
    schema: {
      description: '알림 템플릿 생성',
      tags: ['notification'],
      body: {
        type: 'object' as const,
        required: ['name', 'channel', 'template'],
        properties: { name: { type: 'string' as const }, channel: { type: 'string' as const }, template: { type: 'string' as const }, variables: { type: 'array' as const, items: { type: 'string' as const } } },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: templateLimiter,
  }, createTemplateHandler as never);
  app.get('/notification/templates', {
    schema: { description: '알림 템플릿 목록 조회', tags: ['notification'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, listTemplatesHandler as never);
  app.get('/notification/templates/:id', {
    schema: { description: '알림 템플릿 상세 조회', tags: ['notification'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getTemplateHandler as never);
  app.put('/notification/templates/:id', {
    schema: {
      description: '알림 템플릿 수정',
      tags: ['notification'],
      params: idParam,
      body: { type: 'object' as const, properties: { name: { type: 'string' as const }, channel: { type: 'string' as const }, template: { type: 'string' as const } } },
      response: { 200: successResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: templateLimiter,
  }, updateTemplateHandler as never);
  app.delete('/notification/templates/:id', {
    schema: { description: '알림 템플릿 삭제', tags: ['notification'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: templateLimiter,
  }, deleteTemplateHandler as never);
}
