// 준수 현황 서비스 진입점
// Design Ref: DESIGN-MTU-P14
// Plan SC: MTU-P14

import Fastify from 'fastify';

const PORT = parseInt(process.env['COMPLIANCE-SERVICE_PORT'] ?? '3013', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'compliance-service' }));

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`준수 현황 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`준수 현황 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
