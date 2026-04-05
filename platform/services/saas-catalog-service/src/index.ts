// SaaS 서비스 카탈로그 서비스 진입점
// Design Ref: DESIGN-MTU-P06
// Plan SC: MTU-P06

import Fastify from 'fastify';

const PORT = parseInt(process.env['SAAS-CATALOG-SERVICE_PORT'] ?? '3005', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'saas-catalog-service' }));

  // TODO: MTU-P06 라우트 등록

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SaaS 서비스 카탈로그 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('SaaS 서비스 카탈로그 서비스 기동 실패:', err);
  process.exit(1);
});
