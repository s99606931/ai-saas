// CRM 서비스 진입점
// Design Ref: DESIGN-MTU-P09
// Plan SC: MTU-P09

import Fastify from 'fastify';

const PORT = parseInt(process.env['CRM-SERVICE_PORT'] ?? '3008', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'crm-service' }));

  // MTU-P09 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`CRM 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`CRM 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
