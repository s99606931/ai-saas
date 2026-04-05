// 알림 서비스 라우트
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2
// Plan SC: FR-P11.1~FR-P11.5

import type { FastifyInstance } from 'fastify';
import {
  sendNotificationHandler,
  sendFromTemplateHandler,
  getUserNotificationsHandler,
  markReadHandler,
  listHistoryHandler,
} from './handlers/notification.handler.js';
import {
  createTemplateHandler,
  listTemplatesHandler,
  getTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
} from './handlers/template.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 서비스 수준 내부 인증 (CSAP D-08: 심층 방어)
  // API 게이트웨이가 인증 후 x-internal-service-key 헤더를 주입
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // 알림 발송 (FR-P11.2, FR-P11.3)
  app.post('/notification/send', sendNotificationHandler);

  // 템플릿 기반 발송 (FR-P11.1)
  app.post('/notification/send-template', sendFromTemplateHandler);

  // 사용자 알림 조회 (FR-P11.3)
  app.get('/notification/user/:userId', getUserNotificationsHandler);

  // 알림 읽음 처리 (FR-P11.3)
  app.put('/notification/:id/read', markReadHandler);

  // 발송 이력 (FR-P11.5)
  app.get('/notification/history', listHistoryHandler);

  // 템플릿 CRUD (FR-P11.1)
  app.post('/notification/templates', createTemplateHandler);
  app.get('/notification/templates', listTemplatesHandler);
  app.get('/notification/templates/:id', getTemplateHandler);
  app.put('/notification/templates/:id', updateTemplateHandler);
  app.delete('/notification/templates/:id', deleteTemplateHandler);
}
