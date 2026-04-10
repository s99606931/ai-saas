// 보안 모니터링 서비스 진입점 (경량 모니터링 -- 감사 로그 서비스 HTTP 연동)
// Design Ref: DESIGN-MTU-P15, SVC-OTEL-R3 DESIGN, SVC-INTEGRATE-R11 Plan
// Plan SC: MTU-P15, FR-OTEL.3, FR-INT.1

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'security-monitor-service', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';

const PORT = parseInt(process.env['SECURITY_MONITOR_PORT'] ?? '3014', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  await app.register(responseTimePlugin);

  // Plan SC: FR-INT.1 -- healthPlugin 통합 (CSAP D-07 가용성)
  const auditServiceUrl = process.env['AUDIT_SERVICE_URL'] ?? 'http://localhost:3012';
  await app.register(healthPlugin, {
    serviceName: 'security-monitor-service',
    version: '0.1.0',
    checkers: [
      CommonCheckers.httpService('audit-service', `${auditServiceUrl}/health`),
    ],
  });

  // Plan SC: FR-INT.3 -- rbacPlugin 통합 (CSAP D-08 접근 통제, 심층 방어)
  await app.register(rbacPlugin, {});

  // Plan SC: FR-P15.1~P15.4 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  // CSAP D-07: HTTP Keep-Alive 설정 (k8s 연결 재사용 최적화)
  app.server.keepAliveTimeout = 65000; // ALB 기본 60초보다 길게
  app.server.headersTimeout = 66000;
  app.log.info(`보안 모니터링 서비스(경량) 기동: http://${HOST}:${PORT}`);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} 수신, graceful shutdown 시작`);
    await app.close();
    await shutdownTelemetry();
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
  process.stderr.write(`보안 모니터링 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
