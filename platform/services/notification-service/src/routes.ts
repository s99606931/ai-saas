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
