// 감사 로그 서비스 진입점
// Design Ref: DESIGN-MTU-P13, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: MTU-P13, FR-OTEL.3, FR-INT.1, FR-R18.1, FR-R18.3, FR-R18.4
// CSAP: D-06 침해사고 관리, D-07 가용성, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'audit-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { eventBusPlugin } from '@public-saas/event-bus';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // Plan SC: FR-R18.3 -- configPlugin 통합
  await app.register(configPlugin, {
    defaults: { port: 3012, host: '0.0.0.0' },
    envMapping: { 'AUDIT-SERVICE_PORT': 'port' },
  });

  const PORT = app.config.get<number>('port', 3012);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Plan SC: FR-R18.1 -- meshReadyPlugin (SIGTERM + SIGINT graceful shutdown 내장) 통합
  await app.register(meshReadyPlugin, {
    service: { name: 'audit-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  await app.register(responseTimePlugin);

  // Plan SC: FR-INT.1 -- healthPlugin 통합 (CSAP D-07 가용성)
  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'audit-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  // Plan SC: FR-R18.4 -- eventBusPlugin 통합 (감사 이벤트 수신)
  await app.register(eventBusPlugin, {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxDeadLetters: 200,
  });

  // 크로스 서비스 이벤트 수신 핸들러 (감사 로그 기록)
  app.events.on('user.*', async (payload) => {
    app.log.info({ event: 'user.*', payload }, '사용자 이벤트 감사 기록');
  });
  app.events.on('auth.*', async (payload) => {
    app.log.info({ event: 'auth.*', payload }, '인증 이벤트 감사 기록');
  });
  app.events.on('tenant.*', async (payload) => {
    app.log.info({ event: 'tenant.*', payload }, '테넌트 이벤트 감사 기록');
  });

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`감사 로그 서비스 기동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`감사 로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
