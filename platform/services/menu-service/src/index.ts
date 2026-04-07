// 메뉴 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P05
// Plan SC: MTU-P05

import Fastify from 'fastify';

const PORT = parseInt(process.env['MENU-SERVICE_PORT'] ?? '3004', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'menu-service' }));

  // MTU-P05 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`메뉴 관리 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`메뉴 관리 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
