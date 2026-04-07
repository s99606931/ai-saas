// SaaS 서비스 카탈로그 서비스 진입점
// Design Ref: DESIGN-MTU-P06
// Plan SC: MTU-P06
// NOTE: MTU-P06 라우트는 catalog-service에 구현 완료.
//       이 서비스는 초기 스캐폴딩 잔재. catalog-service를 사용할 것.
//       향후 Phase 2에서 고유 기능(SaaS 마켓플레이스) 구현 예정 시 활성화.
// @deprecated catalog-service 사용 권장

import Fastify from 'fastify';

const PORT = parseInt(process.env['SAAS-CATALOG-SERVICE_PORT'] ?? '3005', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'saas-catalog-service',
    note: 'Placeholder — catalog-service로 라우팅 권장',
  }));

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SaaS 서비스 카탈로그 서비스 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`SaaS 서비스 카탈로그 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
