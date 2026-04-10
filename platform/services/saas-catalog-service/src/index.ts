// SaaS 카탈로그 서비스 진입점
// Design Ref: SVC-SAASCAT-R3 DESIGN, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: FR-SCAT.1~FR-SCAT.7, FR-OTEL.3, FR-INT.1, FR-R18.1, FR-R18.3
// CSAP: D-07 가용성, D-08 접근 통제, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'saas-catalog-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { registerRoutes } from './routes.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(configPlugin, {
    defaults: { port: 3016, host: '0.0.0.0' },
    envMapping: { SAAS_CATALOG_SERVICE_PORT: 'port' },
  });

  const PORT = app.config.get<number>('port', 3016);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  await app.register(meshReadyPlugin, {
    service: { name: 'saas-catalog-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  // X-Response-Time (Plan SC: FR-OTEL.2, CSAP D-10)
  await app.register(responseTimePlugin);

  // saas-catalog-service는 인메모리 스토어 사용, 커스텀 체커
  await app.register(healthPlugin, {
    serviceName: 'saas-catalog-service',
    version: '0.2.0',
    checkers: [
      CommonCheckers.custom('store', async () => true, 1000),
    ],
  });

  await app.register(rbacPlugin, {});

  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`SaaS 카탈로그 서비스 기동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`SaaS 카탈로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
