// 알림 서비스 진입점
// Design Ref: DESIGN-MTU-P11
// Plan SC: MTU-P11

import Fastify from 'fastify';

const PORT = parseInt(process.env['NOTIFICATION-SERVICE_PORT'] ?? '3010', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'notification-service' }));

  // MTU-P11 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`알림 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('알림 서비스 기동 실패:', err);
  process.exit(1);
});
