// 보안 서비스 진입점 (DB 기반 보안 모니터링 — Prisma 연동)
// Design Ref: DESIGN-MTU-P15
// Plan SC: MTU-P15
//
// 역할: DB 기반 정밀 보안 분석 (감사 로그 groupBy, 알림 이력 조회)
// 배포: DB 접근 가능한 내부 네트워크 환경에서 운영

import Fastify from 'fastify';

const PORT = parseInt(process.env['SECURITY_SERVICE_PORT'] ?? '3014', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'security-service' }));

  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`보안 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`보안 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
