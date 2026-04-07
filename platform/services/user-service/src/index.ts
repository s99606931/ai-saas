// 사용자 관리 서비스 진입점
// Design Ref: DESIGN-MTU-P02
// Plan SC: FR-P02.1~FR-P02.10

import Fastify from 'fastify';
import { registerUserRoutes } from './routes.js';

const PORT = parseInt(process.env['USER_SERVICE_PORT'] ?? '3002', 10);
const HOST = process.env['USER_SERVICE_HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'user-service' }));

  await registerUserRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`사용자 관리 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`사용자 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
