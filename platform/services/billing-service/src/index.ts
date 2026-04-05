// 빌링 서비스 진입점
// Design Ref: DESIGN-MTU-P08
// Plan SC: MTU-P08

import Fastify from 'fastify';

const PORT = parseInt(process.env['BILLING-SERVICE_PORT'] ?? '3007', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'billing-service' }));

  // MTU-P08 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`빌링 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('빌링 서비스 기동 실패:', err);
  process.exit(1);
});
