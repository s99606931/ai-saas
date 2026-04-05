// 알림 서비스 진입점
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2
// Plan SC: MTU-P11, MTU-Q2
// CSAP: D-06 감사 로그

import Fastify from 'fastify';
import { notificationEventBus } from './lib/event-bus.js';

const PORT = parseInt(process.env['NOTIFICATION_SERVICE_PORT'] ?? '3010', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'notification-service',
    eventHandlers: notificationEventBus.getHandlerCount(),
  }));

  // 이벤트 버스 기본 핸들러 등록 (FR-P11.4)
  notificationEventBus.on('user.created', async (payload) => {
    app.log.info({ event: 'user.created', ...payload }, '신규 사용자 알림 트리거');
    // 프로덕션에서는 sendFromTemplate 내부 호출
  });

  notificationEventBus.on('security.account_locked', async (payload) => {
    app.log.warn({ event: 'security.account_locked', ...payload }, '계정 잠금 보안 알림');
  });

  notificationEventBus.on('subscription.expiry_warning', async (payload) => {
    app.log.info({ event: 'subscription.expiry_warning', ...payload }, '구독 만료 알림 트리거');
  });

  // 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`알림 서비스 기동: http://${HOST}:${PORT}`);
  app.log.info(`이벤트 핸들러 등록: ${notificationEventBus.getHandlerCount()}개`);
}

main().catch((err) => {
  console.error('알림 서비스 기동 실패:', err);
  process.exit(1);
});
