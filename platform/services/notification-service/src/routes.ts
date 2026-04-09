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
import { createRateLimiter } from './middleware/rate-limit.middleware.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 서비스 수준 내부 인증 (CSAP D-08: 심층 방어)
  // API 게이트웨이가 인증 후 x-internal-service-key 헤더를 주입
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      // 헬스체크 경로 제외 (Kubernetes readinessProbe/livenessProbe 허용)
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

  // FR-NOTIF.1: Rate Limiting (Design Ref: SVC-NOTIF-R1 DESIGN §1)
  const sendLimiter = createRateLimiter(20, 60, 'rl:notif:send');
  const readLimiter = createRateLimiter(100, 60, 'rl:notif:read');
  const templateLimiter = createRateLimiter(30, 60, 'rl:notif:template');

  // 알림 발송 (FR-P11.2, FR-P11.3)
  app.post('/notification/send', { preHandler: sendLimiter }, sendNotificationHandler as never);

  // 템플릿 기반 발송 (FR-P11.1)
  app.post('/notification/send-template', { preHandler: sendLimiter }, sendFromTemplateHandler as never);

  // 사용자 알림 조회 (FR-P11.3)
  app.get('/notification/user/:userId', { preHandler: readLimiter }, getUserNotificationsHandler as never);

  // FR-NOTIF.2: 읽지 않은 알림 카운트
  app.get('/notification/user/:userId/unread-count', { preHandler: readLimiter }, unreadCountHandler as never);

  // FR-NOTIF.3: 일괄 읽음 처리
  app.put('/notification/user/:userId/read-all', { preHandler: readLimiter }, markAllReadHandler as never);

  // 알림 읽음 처리 (FR-P11.3)
  app.put('/notification/:id/read', { preHandler: readLimiter }, markReadHandler as never);

  // 발송 이력 (FR-P11.5, FR-NOTIF.4: 테넌트 격리 강화)
  app.get('/notification/history', { preHandler: readLimiter }, listHistoryHandler as never);

  // FR-NOTIF.5: 알림 통계
  app.get('/notification/stats', { preHandler: readLimiter }, notificationStatsHandler as never);

  // 템플릿 CRUD (FR-P11.1)
  app.post('/notification/templates', { preHandler: templateLimiter }, createTemplateHandler as never);
  app.get('/notification/templates', { preHandler: readLimiter }, listTemplatesHandler as never);
  app.get('/notification/templates/:id', { preHandler: readLimiter }, getTemplateHandler as never);
  app.put('/notification/templates/:id', { preHandler: templateLimiter }, updateTemplateHandler as never);
  app.delete('/notification/templates/:id', { preHandler: templateLimiter }, deleteTemplateHandler as never);
}
