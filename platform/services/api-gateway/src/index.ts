// API 게이트웨이 진입점
// Design Ref: DESIGN-MTU-P04, DESIGN-MTU-Q1, SVC-OTEL-R3 DESIGN
// Plan SC: FR-P04.1~FR-P04.11, FR-OTEL.3
// CSAP: D-08 인증, D-10 네트워크 보안, D-06 감사 로그, D-12 API 문서

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

initTelemetry({ serviceName: 'api-gateway', serviceVersion: '0.1.0' });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { responseTimePlugin } from '@public-saas/observability';
import { registerProxyRoutes } from './routes/proxy.js';
import { SERVICE_REGISTRY } from './registry/service-registry.js';
import { checkServicesHealth } from './plugins/health-check.js';
import auditLoggerPlugin from './plugins/audit-logger.js';
import correlationIdPlugin from './plugins/correlation-id.js';
import swaggerPlugin from './plugins/swagger.js';
import securityHeadersPlugin from './plugins/security-headers.js';
import { ipFilterMiddleware } from './middleware/ip-filter.middleware.js';
import { circuitBreaker } from './lib/circuit-breaker.js';

const PORT = parseInt(process.env['API_GATEWAY_PORT'] ?? '3000', 10);
const HOST = process.env['API_GATEWAY_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  // FR-GW.2: 요청 페이로드 크기 제한 (기본 10MB, CSAP D-10 DoS 방어)
  const bodyLimit = parseInt(process.env['BODY_LIMIT_BYTES'] ?? '10485760', 10);

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] === 'development' ? { target: 'pino-pretty' } : undefined,
    },
    bodyLimit,
  });

  // X-Response-Time (Plan SC: FR-OTEL.2, CSAP D-10)
  await app.register(responseTimePlugin);

  // CORS (Plan SC: FR-P04.8)
  await app.register(cors, {
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3100', 'http://localhost:3200'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Response-Time'],
  });

  // FR-GW.1: IP 접근 제어 (CSAP D-10 네트워크 보안)
  app.addHook('onRequest', ipFilterMiddleware);

  // FR-GW.4: 보안 응답 헤더 (CSAP D-10)
  await app.register(securityHeadersPlugin);

  // Correlation ID -- 분산 추적 (Plan SC: FR-P04.9 보완, CSAP D-06)
  await app.register(correlationIdPlugin);

  // OpenAPI 문서 (Plan SC: FR-P04.10, CSAP D-12)
  await app.register(swaggerPlugin);

  // 감사 로그 (Plan SC: FR-P04.7, CSAP D-06)
  await app.register(auditLoggerPlugin);

  // Rate Limiting (Plan SC: FR-P04.4, CSAP D-10)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const tenantId = request.headers['x-tenant-id'];
      if (typeof tenantId === 'string') {
        return `tenant:${tenantId}`;
      }
      return request.ip;
    },
  });

  // 헬스체크 (Plan SC: FR-P04.9)
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api-gateway',
    registeredServices: Object.keys(SERVICE_REGISTRY).length,
    timestamp: new Date().toISOString(),
  }));

  // 능동 서비스 헬스 확인 (FR-P04.9 보완)
  app.get('/health/services', async (_request, reply) => {
    const results = await checkServicesHealth(SERVICE_REGISTRY);
    const allHealthy = results.every((r) => r.status === 'healthy');
    await reply.status(allHealthy ? 200 : 207).send({
      status: allHealthy ? 'healthy' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: results,
    });
  });

  app.get('/ready', async (_request, reply) => {
    const results = await checkServicesHealth(SERVICE_REGISTRY);
    const allReady = results.every((r) => r.status === 'healthy');
    await reply.status(allReady ? 200 : 503).send({
      status: allReady ? 'ready' : 'not_ready',
      service: 'api-gateway',
      services: results,
    });
  });

  // FR-GW.3: Circuit Breaker 모니터링 엔드포인트 (CSAP D-07 가용성)
  app.get('/admin/circuits', async (request, reply) => {
    const internalKey = process.env['INTERNAL_SERVICE_KEY'];
    const providedKey = request.headers['x-internal-service-key'];
    if (!internalKey || providedKey !== internalKey) {
      await reply.status(403).send({
        success: false,
        error: { code: 'ADMIN_AUTH_REQUIRED', message: '관리 엔드포인트 접근 권한이 없습니다' },
      });
      return;
    }
    return {
      success: true,
      data: circuitBreaker.getAllStatus(),
      timestamp: new Date().toISOString(),
    };
  });

  app.post('/admin/circuits/:serviceId/reset', async (request, reply) => {
    const internalKey = process.env['INTERNAL_SERVICE_KEY'];
    const providedKey = request.headers['x-internal-service-key'];
    if (!internalKey || providedKey !== internalKey) {
      await reply.status(403).send({
        success: false,
        error: { code: 'ADMIN_AUTH_REQUIRED', message: '관리 엔드포인트 접근 권한이 없습니다' },
      });
      return;
    }
    const { serviceId } = request.params as { serviceId: string };
    circuitBreaker.reset(serviceId);
    await reply.send({
      success: true,
      message: `Circuit breaker '${serviceId}' 리셋 완료`,
    });
  });

  // 프록시 라우트 등록 (Plan SC: FR-P04.1)
  await registerProxyRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API 게이트웨이 기동: http://${HOST}:${PORT}`);
  app.log.info(`등록된 서비스: ${Object.keys(SERVICE_REGISTRY).join(', ')}`);

  // Graceful Shutdown (CSAP D-07: k8s terminationGracePeriod 연동)
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
  process.stderr.write(`API 게이트웨이 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
