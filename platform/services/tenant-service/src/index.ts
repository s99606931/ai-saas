// 테넌트 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P03
// Plan SC: FR-P03.1~FR-P03.8
// CSAP: N2SF N-03 격리 아키텍처

import Fastify from 'fastify';
import { registerTenantRoutes } from './routes.js';

const PORT = parseInt(process.env['TENANT_SERVICE_PORT'] ?? '3003', 10);
const HOST = process.env['TENANT_SERVICE_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'tenant-service' }));

  await registerTenantRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`테넌트 관리 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`테넌트 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
