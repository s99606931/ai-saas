// 준수 현황 서비스 라우트
// Design Ref: DESIGN-MTU-P14 §2, SVC-COMP-R1 DESIGN
// Plan SC: FR-P14.1~FR-P14.4, FR-COMP.1~FR-COMP.4

import type { FastifyInstance } from 'fastify';
import {
  csapComplianceHandler,
  n2sfComplianceHandler,
  readinessHandler,
  metricsHandler,
  csapGapsHandler,
  complianceHistoryHandler,
} from './handlers/compliance.handler.js';
import { complianceTrendHandler, complianceSummaryHandler } from './handlers/compliance-trend.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증 — API 게이트웨이 우회 차단
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다. 서비스를 시작할 수 없습니다.');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      // 헬스체크 경로 제외 (Kubernetes readinessProbe/livenessProbe 허용)
      if (request.url === '/health' || request.url === '/ready') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // FR-COMP.1: Rate Limiting (Design Ref: SVC-COMP-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:comp:read');

  // FR-P14.1: CSAP 79항목 준수율
  app.get('/compliance/csap', { preHandler: readLimiter }, csapComplianceHandler as never);

  // FR-COMP.2: CSAP 미준수 항목 상세
  app.get('/compliance/csap/gaps', { preHandler: readLimiter }, csapGapsHandler as never);

  // FR-P14.2: N2SF 6영역 현황
  app.get('/compliance/n2sf', { preHandler: readLimiter }, n2sfComplianceHandler as never);

  // FR-P14.3: 감리 준비도 점수
  app.get('/compliance/readiness', { preHandler: readLimiter }, readinessHandler as never);

  // FR-COMP.3: 준수율 스냅샷 이력
  app.get('/compliance/history', { preHandler: readLimiter }, complianceHistoryHandler as never);

  // FR-P14.4: OpenTelemetry 메트릭
  app.get('/compliance/metrics', { preHandler: readLimiter }, metricsHandler as never);

  // FR-COMP.5: 준수율 추이
  app.get('/compliance/trend', { preHandler: readLimiter }, complianceTrendHandler as never);

  // FR-COMP.6: 통합 요약 대시보드
  app.get('/compliance/summary', { preHandler: readLimiter }, complianceSummaryHandler as never);
}
