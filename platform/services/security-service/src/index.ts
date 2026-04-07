// 보안 서비스 진입점 (DB 기반 보안 모니터링 — Prisma 연동)
// Design Ref: DESIGN-MTU-P15
// Plan SC: MTU-P15
//
// 역할: DB 기반 정밀 보안 분석 (감사 로그 groupBy, 알림 이력 조회)
// 배포: DB 접근 가능한 내부 네트워크 환경에서 운영

import Fastify from 'fastify';

const PORT = parseInt(process.env['SECURITY_SERVICE_PORT'] ?? '3014', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'security-service' }));

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
      service: 'security-service',
      checks,
    });
  });

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`보안 서비스 기동: http://${HOST}:${PORT}`);

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
  process.stderr.write(`보안 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
