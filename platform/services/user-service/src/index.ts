// 사용자 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.1~FR-P02.10

import Fastify from 'fastify';
import { registerUserRoutes } from './routes.js';

const PORT = parseInt(process.env['USER_SERVICE_PORT'] ?? '3002', 10);
const HOST = process.env['USER_SERVICE_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'user-service' }));

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
      service: 'user-service',
      checks,
    });
  });

  await registerUserRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`사용자 관리 서비스 기동: http://${HOST}:${PORT}`);

  // Graceful Shutdown (CSAP D-07: k8s terminationGracePeriod 연동)
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} 수신, graceful shutdown 시작`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`사용자 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
