// CRM 서비스 진입점
// Design Ref: DESIGN-MTU-P09, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: MTU-P09, FR-OTEL.3, FR-INT.1, FR-R18.1~FR-R18.3
// CSAP: D-07 가용성, D-08 접근 통제, D-09 테넌트 암호화, D-10 분산 추적

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'crm-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { tenantIsolationPlugin } from '@public-saas/tenant-isolation';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // Plan SC: FR-R18.3 -- configPlugin 통합
  await app.register(configPlugin, {
    defaults: { port: 3008, host: '0.0.0.0' },
    envMapping: {
      'CRM-SERVICE_PORT': 'port',
      TENANT_MASTER_KEY: 'tenantMasterKey',
    },
  });

  const PORT = app.config.get<number>('port', 3008);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Plan SC: FR-R18.1 -- meshReadyPlugin (SIGTERM + SIGINT graceful shutdown 내장) 통합
  await app.register(meshReadyPlugin, {
    service: { name: 'crm-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [async () => { await shutdownTelemetry(); }],
    },
  });

  await app.register(responseTimePlugin);

  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'crm-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  await app.register(rbacPlugin, {});

  // Plan SC: FR-R18.2 -- tenantIsolationPlugin 통합 (CSAP D-08, D-09)
  const masterKey = app.config.get<string>('tenantMasterKey', '');
  await app.register(tenantIsolationPlugin, {
    masterKey: masterKey || undefined,
    tenantColumn: 'tenant_id',
    requireTenantHeader: true,
    excludePaths: ['/health', '/ready', '/metadata', '/health/detail', '/health/sla'],
  });

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`CRM 서비스 기동: http://${HOST}:${PORT}`);

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`CRM 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
