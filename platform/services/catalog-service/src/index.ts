// SaaS 카탈로그 서비스 진입점
// Design Ref: DESIGN-MTU-P06, SVC-OTEL-R3 DESIGN
// Plan SC: MTU-P06, FR-OTEL.3

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'catalog-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env['CATALOG-SERVICE_PORT'] ?? '3005', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(responseTimePlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'catalog-service' }));

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
      service: 'catalog-service',
      checks,
    });
  });

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
