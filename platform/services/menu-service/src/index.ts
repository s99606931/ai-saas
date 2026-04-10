// 메뉴 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P05, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: MTU-P05, FR-OTEL.3, FR-INT.1, FR-INT.2, FR-R18.1, FR-R18.3
// CSAP: D-07 가용성, D-08 접근 통제, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'menu-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { cachePlugin } from '@public-saas/cache';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(configPlugin, {
    defaults: { port: 3004, host: '0.0.0.0' },
    envMapping: { 'MENU-SERVICE_PORT': 'port' },
  });

  const PORT = app.config.get<number>('port', 3004);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Graceful Shutdown: SIGTERM + SIGINT 시그널 자동 핸들링
  await app.register(meshReadyPlugin, {
    service: { name: 'menu-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  await app.register(responseTimePlugin);

  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'menu-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  await app.register(rbacPlugin, {});

  await app.register(cachePlugin, {
    config: { defaultTtlSeconds: 600, prefix: 'saas:menu' },
  });

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`메뉴 관리 서비스 ��동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`메뉴 관리 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
