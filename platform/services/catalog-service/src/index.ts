// SaaS 카탈로그 서비스 진입점
// Design Ref: DESIGN-MTU-P06
// Plan SC: MTU-P06

import Fastify from 'fastify';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env['CATALOG-SERVICE_PORT'] ?? '3005', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'catalog-service' }));

  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SaaS 카탈로그 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`SaaS 카탈로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
