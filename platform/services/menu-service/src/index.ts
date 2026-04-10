// 메뉴 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P05, SVC-OTEL-R3 DESIGN
// Plan SC: MTU-P05, FR-OTEL.3

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'menu-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

const PORT = parseInt(process.env['MENU-SERVICE_PORT'] ?? '3004', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(responseTimePlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'menu-service' }));

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
      service: 'menu-service',
      checks,
    });
  });

  // MTU-P05 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`메뉴 관리 서비스 기동: http://${HOST}:${PORT}`);

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
  process.stderr.write(`메뉴 관리 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
