// 보안 모니터링 서비스 진입점 (경량 모니터링 — 감사 로그 서비스 HTTP 연동)
// Design Ref: DESIGN-MTU-P15
// Plan SC: MTU-P15
//
// 역할 분리:
//   security-service (포트 3014): DB 기반 보안 모니터링 (Prisma, 프로덕션 정밀 분석)
//   security-monitor-service (포트 3015): 경량 모니터링 (HTTP 기반, 스탠드얼론/사이드카 배포 가능)
//
// 두 서비스는 동일 FR-P15.1~P15.4를 구현하되 배포 시나리오가 다릅니다.
// - DB 접근 가능 환경 → security-service 단독 배포
// - DB 미접근 환경 (DMZ/사이드카) → security-monitor-service 배포

import Fastify from 'fastify';

const PORT = parseInt(process.env['SECURITY_MONITOR_SERVICE_PORT'] ?? '3015', 10);
const HOST = '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok', service: 'security-monitor-service' }));

  // Plan SC: FR-P15.1~P15.4 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`보안 모니터링 서비스(경량) 기동: http://${HOST}:${PORT}`);
}

main().catch((err) => {
  process.stderr.write(`보안 모니터링 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
