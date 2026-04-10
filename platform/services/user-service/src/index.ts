// 사용자 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P02, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan
// Plan SC: FR-P02.1~FR-P02.10, FR-OTEL.3, FR-INT.1, FR-INT.2

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

// OpenTelemetry 초기화 (모든 import 전에 실행 -- 자동 계측 hook 등록)
// Plan SC: FR-OTEL.3
initTelemetry({ serviceName: 'user-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { cachePlugin } from '@public-saas/cache';
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

  // Plan SC: FR-INT.1 -- healthPlugin 통합 (CSAP D-07 가용성)
  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'user-service',
    version: '0.1.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  // Plan SC: FR-INT.2 -- cachePlugin 통합 (CSAP D-07 가용성)
  await app.register(cachePlugin, {
    config: { defaultTtlSeconds: 120, prefix: 'saas:user' },
  });

  await registerUserRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  // CSAP D-07: HTTP Keep-Alive 설정 (k8s 연결 재사용 최적화)
  app.server.keepAliveTimeout = 65000; // ALB 기본 60초보다 길게
  app.server.headersTimeout = 66000;
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
