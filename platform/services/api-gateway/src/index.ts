// API 게이트웨이 진입점
// Design Ref: DESIGN-MTU-P04, DESIGN-MTU-Q1
// Plan SC: FR-P04.1~FR-P04.11
// CSAP: D-08 인증, D-10 네트워크 보안, D-06 감사 로그, D-12 API 문서

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerProxyRoutes } from './routes/proxy.js';
import { SERVICE_REGISTRY } from './registry/service-registry.js';
import { checkServicesHealth } from './plugins/health-check.js';
import auditLoggerPlugin from './plugins/audit-logger.js';
import correlationIdPlugin from './plugins/correlation-id.js';
import swaggerPlugin from './plugins/swagger.js';

const PORT = parseInt(process.env['API_GATEWAY_PORT'] ?? '3000', 10);
const HOST = process.env['API_GATEWAY_HOST'] ?? '0.0.0.0';

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

  // CORS (Plan SC: FR-P04.8)
  await app.register(cors, {
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3100', 'http://localhost:3200'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  // Correlation ID — 분산 추적 (Plan SC: FR-P04.9 보완, CSAP D-06)
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
      // 테넌트 기반 제한 (인증된 요청)
      const tenantId = request.headers['x-tenant-id'];
      if (typeof tenantId === 'string') {
        return `tenant:${tenantId}`;
      }
      // IP 기반 제한 (미인증 요청)
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

  // 능동 서비스 헬스 확인 (FR-P04.9 보완 — 다운스트림 실상태 포함)
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

  // 프록시 라우트 등록 (Plan SC: FR-P04.1)
  await registerProxyRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API 게이트웨이 기동: http://${HOST}:${PORT}`);
  app.log.info(`등록된 서비스: ${Object.keys(SERVICE_REGISTRY).join(', ')}`);

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
  process.stderr.write(`API 게이트웨이 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
