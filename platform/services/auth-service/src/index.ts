// 인증 서비스 진입점
// Design Ref: MTU-P01 DESIGN-MTU-P01, SVC-AUTH-R1 DESIGN
// Plan SC: FR-P01.1~FR-P01.12, FR-AUTH.1~FR-AUTH.7
// CSAP: D-08 접근 통제

import { initTelemetry, shutdownTelemetry } from './lib/telemetry.js';

// OpenTelemetry 초기화 (모든 import 전에 실행 — 자동 계측 hook 등록)
// Plan SC: FR-AUTH.6
initTelemetry();

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

  // CORS 설정 (CSAP D-10: 허용 메서드/헤더 명시적 제한)
  await app.register(cors, {
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Request-ID'],
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

  // Graceful Shutdown (CSAP D-07: k8s terminationGracePeriod 연동)
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} 수신, graceful shutdown 시작`);
    await app.close();
    await shutdownTelemetry(); // Plan SC: FR-AUTH.6 — OTel 종료
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`인증 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
