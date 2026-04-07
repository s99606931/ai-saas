// 인증 서비스 진입점
// Design Ref: MTU-P01 DESIGN-MTU-P01
// Plan SC: FR-P01.1~FR-P01.12
// CSAP: D-08 접근 통제

import Fastify from 'fastify';
import cors from '@fastify/cors';
import authMiddleware from './middleware/auth.middleware.js';
import { registerAuthRoutes } from './routes.js';

const PORT = parseInt(process.env['AUTH_SERVICE_PORT'] ?? '3001', 10);
const HOST = process.env['AUTH_SERVICE_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  // CORS 설정
  await app.register(cors, {
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // JWT 인증 미들웨어 등록 (Plan SC: FR-P01.2)
  await app.register(authMiddleware);

  // 헬스체크
  app.get('/health', async () => ({ status: 'ok', service: 'auth-service' }));
  app.get('/ready', async (_request, reply) => {
    // CSAP D-07: k8s readinessProbe용 — DB 및 Redis 연결 상태 확인
    const checks: Record<string, string> = {};
    let allReady = true;

    // Redis 연결 확인
    try {
      const { redis } = await import('./lib/session.js');
      const pong = await redis.ping();
      checks['redis'] = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks['redis'] = 'error';
      allReady = false;
    }

    // DB(Prisma) 연결 확인
    try {
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$queryRaw`SELECT 1`;
      checks['database'] = 'ok';
    } catch {
      checks['database'] = 'error';
      allReady = false;
    }

    const status = allReady ? 'ready' : 'not_ready';
    await reply.status(allReady ? 200 : 503).send({
      status,
      service: 'auth-service',
      checks,
    });
  });

  // 인증 라우트 등록
  await registerAuthRoutes(app);

  // 서버 시작
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`인증 서비스 기동 완료: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`인증 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
