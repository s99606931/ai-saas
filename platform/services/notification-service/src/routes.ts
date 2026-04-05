// 알림 서비스 라우트
// Design Ref: DESIGN-MTU-P11
// Plan SC: FR-P11.1~FR-P11.5

import type { FastifyInstance } from 'fastify';
import {
  sendNotificationHandler,
  getUserNotificationsHandler,
  markReadHandler,
  listHistoryHandler,
} from './handlers/notification.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/notification/send', sendNotificationHandler);
  app.get('/notification/user/:userId', getUserNotificationsHandler);
  app.put('/notification/:id/read', markReadHandler);
  app.get('/notification/history', listHistoryHandler);
}
