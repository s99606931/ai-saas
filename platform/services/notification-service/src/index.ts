// 알림 서비스 진입점
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2, SVC-OTEL-R3 DESIGN
// Plan SC: MTU-P11, MTU-Q2, FR-OTEL.3
// CSAP: D-06 감사 로그

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'notification-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { notificationEventBus } from './lib/event-bus.js';

const PORT = parseInt(process.env['NOTIFICATION_SERVICE_PORT'] ?? '3010', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(responseTimePlugin);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'notification-service',
    eventHandlers: notificationEventBus.getHandlerCount(),
  }));

  // Readiness 프로브 (CSAP D-07: DB 연결 상태 포함)
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, string> = {};
    let allReady = true;
    try {
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$queryRaw`SELECT 1`;
      checks['database'] = 'ok';
    } catch {
      checks['database'] = 'error';
      allReady = false;
    }
    await reply.status(allReady ? 200 : 503).send({
      status: allReady ? 'ready' : 'not_ready',
      service: 'notification-service',
      checks,
    });
  });

  // 이벤트 버스 기본 핸들러 등록 (FR-P11.4)
  notificationEventBus.on('user.created', async (payload) => {
    app.log.info({ event: 'user.created', ...payload }, '신규 사용자 알림 트리거');
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
  // CSAP D-07: HTTP Keep-Alive 설정 (k8s 연결 재사용 최적화)
  app.server.keepAliveTimeout = 65000; // ALB 기본 60초보다 길게
  app.server.headersTimeout = 66000;
  app.log.info(`알림 서비스 기동: http://${HOST}:${PORT}`);
  app.log.info(`이벤트 핸들러 등록: ${notificationEventBus.getHandlerCount()}개`);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} 수신, graceful shutdown 시작`);
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // CSAP D-07: 예기치 못한 에러 안전 처리 (무응답 방지)
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 — 서비스 종료');
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`알림 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
