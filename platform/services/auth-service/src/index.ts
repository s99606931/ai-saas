// 인증 서비스 진입점
// Design Ref: MTU-P01 DESIGN-MTU-P01, SVC-AUTH-R1 DESIGN, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan, SVC-INTEGRATE-R18 Plan
// Plan SC: FR-P01.1~FR-P01.12, FR-AUTH.1~FR-AUTH.7, FR-OTEL.3, FR-INT.1, FR-INT.3, FR-R18.1, FR-R18.3, FR-R18.4
// CSAP: D-08 접근 통제, D-07 가용성, D-10 분산 추적, D-06 이벤트 기반 감사

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

// OpenTelemetry 초기화 (모든 import 전에 실행 -- 자동 계측 hook 등록)
// Plan SC: FR-AUTH.6, FR-OTEL.3
initTelemetry({ serviceName: 'auth-service', serviceVersion: '0.3.0' });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { eventBusPlugin } from '@public-saas/event-bus';
import authMiddleware from './middleware/auth.middleware.js';
import { registerAuthRoutes } from './routes.js';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // Plan SC: FR-R18.3 -- configPlugin 통합 (중앙 설정 관리)
  await app.register(configPlugin, {
    defaults: {
      port: 3001,
      host: '0.0.0.0',
      corsOrigin: 'http://localhost:3000',
    },
    envMapping: {
      AUTH_SERVICE_PORT: 'port',
      AUTH_SERVICE_HOST: 'host',
      CORS_ORIGIN: 'corsOrigin',
    },
  });

  const PORT = app.config.get<number>('port', 3001);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // Plan SC: FR-R18.1 -- meshReadyPlugin 통합 (분산 추적 + 그레이스풀 셧다운)
  await app.register(meshReadyPlugin, {
    service: { name: 'auth-service', version: '0.3.0' },
    shutdown: {
      cleanupHandlers: [
        async () => { await shutdownTelemetry(); },
      ],
    },
  });

  // X-Response-Time (Plan SC: FR-OTEL.2, CSAP D-10)
  await app.register(responseTimePlugin);

  // CORS 설정 (CSAP D-10: 허용 메서드/헤더 명시적 제한)
  const corsOrigin = app.config.get<string>('corsOrigin', 'http://localhost:3000');
  await app.register(cors, {
    origin: corsOrigin.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Request-ID'],
  });

  // Plan SC: FR-INT.1 -- healthPlugin 통합 (CSAP D-07 가용성)
  const { prisma } = await import('./lib/prisma.js');
  const { redis } = await import('./lib/session.js');
  await app.register(healthPlugin, {
    serviceName: 'auth-service',
    version: '0.3.0',
    checkers: [
      CommonCheckers.database(prisma),
      CommonCheckers.custom('redis', async () => {
        const pong = await redis.ping();
        return pong === 'PONG';
      }, 3000),
    ],
  });

  // Plan SC: FR-INT.3 -- rbacPlugin 통합 (CSAP D-08 접근 통제)
  await app.register(rbacPlugin, {
    auditLogger: (event) => {
      app.log.info({ rbacEvent: event }, 'RBAC 감사 로그');
    },
  });

  // Plan SC: FR-R18.4 -- eventBusPlugin 통합 (CSAP D-06 이벤트 기반 감사)
  await app.register(eventBusPlugin, {
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxDeadLetters: 100,
  });

  // JWT 인증 미들웨어 등록 (Plan SC: FR-P01.2)
  await app.register(authMiddleware);

  // 인증 라우트 등록
  await registerAuthRoutes(app);

  // 서버 시작
  await app.listen({ port: PORT, host: HOST });
  // CSAP D-07: HTTP Keep-Alive 설정 (k8s 연결 재사용 최적화)
  app.server.keepAliveTimeout = 65000; // ALB 기본 60초보다 길게
  app.server.headersTimeout = 66000;
  app.log.info(`인증 서비스 기동 완료: http://${HOST}:${PORT}`);

  // CSAP D-07: 예기치 못한 에러 안전 처리 (무응답 방지)
  // NOTE: meshReadyPlugin이 SIGTERM/SIGINT를 처리하므로 수동 핸들러 불필요
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`인증 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
