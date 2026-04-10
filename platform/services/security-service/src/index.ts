// 보안 서비스 진입점 (DB 기반 보안 모니터링 -- Prisma 연동)
// Design Ref: DESIGN-MTU-P15, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: MTU-P15, FR-OTEL.3, FR-INT.1, FR-R18.1, FR-R18.3, FR-R18.4
// CSAP: D-07 가용성, D-08 접근 통제, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'security-service', serviceVersion: '0.2.0' });

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

  await app.register(configPlugin, {
    defaults: { port: 3014, host: '0.0.0.0' },
    envMapping: { SECURITY_SERVICE_PORT: 'port' },
  });

  const PORT = app.config.get<number>('port', 3014);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Graceful Shutdown: SIGTERM + SIGINT 시그널 자동 핸들링
  await app.register(meshReadyPlugin, {
    service: { name: 'security-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  await app.register(responseTimePlugin);

  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'security-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  await app.register(rbacPlugin, {});

  // Plan SC: FR-R18.4 -- eventBusPlugin 통합 (보안 이벤트 수신)
  await app.register(eventBusPlugin, {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxDeadLetters: 200,
  });

  // 보안 이벤트 수신 핸들러
  app.events.on('auth.login_failed', async (payload) => {
    app.log.warn({ event: 'auth.login_failed', payload }, '로그인 실패 보안 탐지');
  });
  app.events.on('security.*', async (payload) => {
    app.log.info({ event: 'security.*', payload }, '보안 이벤트 수신');
  });

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`보안 서비스 기동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`보안 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
