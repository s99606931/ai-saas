// 테넌트 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P03, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: FR-P03.1~FR-P03.8, FR-OTEL.3, FR-INT.1, FR-INT.2, FR-R18.1~FR-R18.3
// CSAP: N2SF N-03 격리 아키텍처, D-07 가용성, D-08 접근 통제, D-09 암호화

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'tenant-service', serviceVersion: '0.2.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { cachePlugin } from '@public-saas/cache';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { tenantIsolationPlugin } from '@public-saas/tenant-isolation';
import { registerTenantRoutes } from './routes.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // Plan SC: FR-R18.3 -- configPlugin 통합 (중앙 설정 관리)
  await app.register(configPlugin, {
    defaults: {
      port: 3003,
      host: '0.0.0.0',
      cacheTtl: 300,
    },
    envMapping: {
      TENANT_SERVICE_PORT: 'port',
      TENANT_SERVICE_HOST: 'host',
      TENANT_MASTER_KEY: 'tenantMasterKey',
    },
  });

  const PORT = app.config.get<number>('port', 3003);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Plan SC: FR-R18.1 -- meshReadyPlugin 통합 (분산 추적 + 그레이스풀 셧다운)
  // Graceful Shutdown: SIGTERM + SIGINT 시그널 자동 핸들링 (meshReadyPlugin 내장)
  await app.register(meshReadyPlugin, {
    service: { name: 'tenant-service', version: '0.2.0' },
    shutdown: {
      cleanupHandlers: [
        async () => { await shutdownTelemetry(); },
      ],
    },
  });

  await app.register(responseTimePlugin);

  // Plan SC: FR-INT.1 -- healthPlugin 통합 (CSAP D-07 가용성)
  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'tenant-service',
    version: '0.2.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  // Plan SC: FR-INT.3 -- rbacPlugin 통합 (CSAP D-08 접근 통제, 심층 방어)
  await app.register(rbacPlugin, {});

  // Plan SC: FR-INT.2 -- cachePlugin 통합 (CSAP D-07 가용성)
  await app.register(cachePlugin, {
    config: { defaultTtlSeconds: 300, prefix: 'saas:tenant' },
  });

  // Plan SC: FR-R18.2 -- tenantIsolationPlugin 통합 (CSAP D-08, D-09)
  const masterKey = app.config.get<string>('tenantMasterKey', '');
  await app.register(tenantIsolationPlugin, {
    masterKey: masterKey || undefined,
    tenantColumn: 'tenant_id',
    requireTenantHeader: true,
    excludePaths: ['/health', '/ready', '/metadata', '/health/detail', '/health/sla'],
  });

  await registerTenantRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
  app.log.info(`테넌트 관리 서비스 기동: http://${HOST}:${PORT}`);

  // CSAP D-07: 예기치 못한 에러 안전 처리 (무응답 방지)
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`테넌트 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
