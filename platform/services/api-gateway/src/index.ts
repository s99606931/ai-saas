// API 게이트웨이 진입점
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.1~FR-P04.11
// CSAP: D-08 인증, D-10 네트워크 보안

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerProxyRoutes } from './routes/proxy.js';
import { SERVICE_REGISTRY } from './registry/service-registry.js';

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
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Id'],
  });

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
  }));

  app.get('/ready', async () => ({
    status: 'ready',
    service: 'api-gateway',
    services: Object.entries(SERVICE_REGISTRY).map(([key, svc]) => ({
      name: key,
      url: svc.url,
    })),
  }));

  // 프록시 라우트 등록 (Plan SC: FR-P04.1)
  await registerProxyRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API 게이트웨이 기동: http://${HOST}:${PORT}`);
  app.log.info(`등록된 서비스: ${Object.keys(SERVICE_REGISTRY).join(', ')}`);
}

main().catch((err) => {
  console.error('API 게이트웨이 기동 실패:', err);
  process.exit(1);
});
