// 감사 로그 서비스 진입점
// Design Ref: DESIGN-MTU-P13
// Plan SC: MTU-P13

import Fastify from 'fastify';

const PORT = parseInt(process.env['AUDIT-SERVICE_PORT'] ?? '3012', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'audit-service' }));

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`감사 로그 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`감사 로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
