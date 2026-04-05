// 보안 모니터링 서비스 진입점
// Design Ref: DESIGN-MTU-P15
// Plan SC: MTU-P15

import Fastify from 'fastify';

const PORT = parseInt(process.env['SECURITY-SERVICE_PORT'] ?? '3014', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'security-service' }));

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`보안 모니터링 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('보안 모니터링 서비스 기동 실패:', err);
  process.exit(1);
});
