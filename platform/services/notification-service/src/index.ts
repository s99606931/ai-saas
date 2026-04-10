// 알림 서비스 진입점
// Design Ref: DESIGN-MTU-P11, DESIGN-MTU-Q2, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: MTU-P11, MTU-Q2, FR-OTEL.3, FR-INT.1, FR-R18.1, FR-R18.3, FR-R18.4
// CSAP: D-06 감사 로그, D-07 가용성, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'notification-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { eventBusPlugin } from '@public-saas/event-bus';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // Plan SC: FR-R18.3 -- configPlugin 통합
  await app.register(configPlugin, {
    defaults: { port: 3010, host: '0.0.0.0' },
    envMapping: { NOTIFICATION_SERVICE_PORT: 'port' },
  });

  const PORT = app.config.get<number>('port', 3010);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Plan SC: FR-R18.1 -- meshReadyPlugin (SIGTERM + SIGINT graceful shutdown 내장) 통합
  await app.register(meshReadyPlugin, {
    service: { name: 'notification-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  await app.register(responseTimePlugin);

  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'notification-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  await app.register(rbacPlugin, {});

  // Plan SC: FR-R18.4 -- eventBusPlugin 통합 (CSAP D-06 이벤트 기반 알림)
  await app.register(eventBusPlugin, {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxDeadLetters: 100,
  });

  // 이벤트 핸들러 등록 (크로스 서비스 이벤트 기반 알림 트리거)
  app.events.on('user.created', async (payload) => {
    app.log.info({ event: 'user.created', payload }, '신규 사용자 알림 트리거');
  });

  app.events.on('security.account_locked', async (payload) => {
    app.log.warn({ event: 'security.account_locked', payload }, '계정 잠금 보안 알림');
  });

  app.events.on('subscription.expiry_warning', async (payload) => {
    app.log.info({ event: 'subscription.expiry_warning', payload }, '구독 만료 알림 트리거');
  });

  app.events.on('auth.login_failed', async (payload) => {
    app.log.warn({ event: 'auth.login_failed', payload }, '로그인 실패 보안 알림');
  });

  // 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`알림 서비스 기동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`알림 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
