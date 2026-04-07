// AI 서비스 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P10
// Plan SC: MTU-P10

import Fastify from 'fastify';

const PORT = parseInt(process.env['AI-SERVICE_PORT'] ?? '3009', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'ai-service' }));

  // MTU-P10 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`AI 서비스 관리 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`AI 서비스 관리 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
