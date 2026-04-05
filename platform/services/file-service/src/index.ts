// 파일 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P12
// Plan SC: MTU-P12

import Fastify from 'fastify';

const PORT = parseInt(process.env['FILE-SERVICE_PORT'] ?? '3011', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'file-service' }));

  // MTU-P12 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`파일 관리 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('파일 관리 서비스 기동 실패:', err);
  process.exit(1);
});
