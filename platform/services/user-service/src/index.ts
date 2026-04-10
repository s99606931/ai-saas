// 사용자 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P02, SVC-OTEL-R3 DESIGN
// Plan SC: FR-P02.1~FR-P02.10, FR-OTEL.3

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

// OpenTelemetry 초기화 (모든 import 전에 실행 -- 자동 계측 hook 등록)
// Plan SC: FR-OTEL.3
initTelemetry({ serviceName: 'user-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { registerUserRoutes } from './routes.js';

const PORT = parseInt(process.env['USER_SERVICE_PORT'] ?? '3002', 10);
const HOST = process.env['USER_SERVICE_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  // X-Response-Time 미들웨어 (Plan SC: FR-OTEL.2, CSAP D-10)
  await app.register(responseTimePlugin);

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
    await shutdownTelemetry(); // Plan SC: FR-OTEL.3 -- OTel graceful shutdown
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // CSAP D-07: 예기치 못한 에러 안전 처리 (무응답 방지)
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 — 서비스 종료');
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`사용자 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
