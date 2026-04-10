// SaaS 카탈로그 서비스 진입점
// Design Ref: SVC-SAASCAT-R3 DESIGN, SVC-OTEL-R3 DESIGN
// Plan SC: FR-SCAT.1~FR-SCAT.7, FR-OTEL.3

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'saas-catalog-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env['SAAS_CATALOG_SERVICE_PORT'] ?? '3016', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // X-Response-Time (Plan SC: FR-OTEL.2, CSAP D-10)
  await app.register(responseTimePlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'saas-catalog-service' }));

  // Readiness 프로브
  app.get('/ready', async () => ({
    status: 'ready',
    service: 'saas-catalog-service',
    checks: { store: 'ok' },
  }));

  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SaaS 카탈로그 서비스 기동: http://${HOST}:${PORT}`);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} 수신, graceful shutdown 시작`);
    await app.close();
    await shutdownTelemetry();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`SaaS 카탈로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
