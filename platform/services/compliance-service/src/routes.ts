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

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const, additionalProperties: true } },
} as const;

const errorResponse = {
  type: 'object' as const,
  additionalProperties: true, properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const, additionalProperties: true } },
} as const;

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
  app.get('/compliance/csap', {
    schema: { description: 'CSAP 79항목 준수율 조회', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, csapComplianceHandler as never);

  // FR-COMP.2: CSAP 미준수 항목 상세
  app.get('/compliance/csap/gaps', {
    schema: { description: 'CSAP 미준수 항목 상세 조회', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, csapGapsHandler as never);

  // FR-P14.2: N2SF 6영역 현황
  app.get('/compliance/n2sf', {
    schema: { description: 'N2SF 6영역 현황 조회', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, n2sfComplianceHandler as never);

  // FR-P14.3: 감리 준비도 점수
  app.get('/compliance/readiness', {
    schema: { description: '감리 준비도 점수 조회', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, readinessHandler as never);

  // FR-COMP.3: 준수율 스냅샷 이력
  app.get('/compliance/history', {
    schema: {
      description: '준수율 스냅샷 이력 조회',
      tags: ['compliance'],
      querystring: { type: 'object' as const, properties: { limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, complianceHistoryHandler as never);

  // FR-P14.4: OpenTelemetry 메트릭
  app.get('/compliance/metrics', {
    schema: { description: 'OpenTelemetry 메트릭 조회', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, metricsHandler as never);

  // FR-COMP.5: 준수율 추이
  app.get('/compliance/trend', {
    schema: {
      description: '준수율 추이 조회',
      tags: ['compliance'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 365, default: 30 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, complianceTrendHandler as never);

  // FR-COMP.6: 통합 요약 대시보드
  app.get('/compliance/summary', {
    schema: { description: '통합 준수 요약 대시보드', tags: ['compliance'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, complianceSummaryHandler as never);
}
