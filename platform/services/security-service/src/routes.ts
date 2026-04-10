// 보안 모니터링 서비스 라우트
// Design Ref: DESIGN-MTU-P15 §2
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  loginFailuresHandler,
  anomaliesHandler,
  getIpBlocklistHandler,
  addIpBlocklistHandler,
  removeIpBlocklistHandler,
  securityAlertsHandler,
} from './handlers/security.handler.js';
import { securityDashboardHandler, threatTrendHandler } from './handlers/security-stats.handler.js';
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

  // CSAP D-08-06: Rate Limiting (보안 API는 엄격 제한)
  const readLimiter = createRateLimiter(60, 60, 'rl:sec:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:sec:write');

  // FR-SEC.1: 보안 대시보드
  app.get('/security/dashboard', {
    schema: { description: '보안 대시보드 통계', tags: ['security'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, securityDashboardHandler as never);

  // FR-SEC.4: 위협 추이
  app.get('/security/threat-trend', {
    schema: {
      description: '위협 추이 조회',
      tags: ['security'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 90, default: 7 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, threatTrendHandler as never);

  // FR-P15.1: 로그인 실패 패턴 탐지
  app.get('/security/login-failures', {
    schema: { description: '로그인 실패 패턴 탐지', tags: ['security'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, loginFailuresHandler);

  // FR-P15.2: 이상 접근 패턴 탐지
  app.get('/security/anomalies', {
    schema: { description: '이상 접근 패턴 탐지', tags: ['security'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, anomaliesHandler);

  // FR-P15.3: IP 차단 목록 관리
  app.get('/security/ip-blocklist', {
    schema: { description: 'IP 차단 목록 조회', tags: ['security'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getIpBlocklistHandler);
  app.post('/security/ip-blocklist', {
    schema: {
      description: 'IP 차단 등록',
      tags: ['security'],
      body: { type: 'object' as const, required: ['ip'], properties: { ip: { type: 'string' as const }, reason: { type: 'string' as const } } },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, addIpBlocklistHandler);
  app.delete('/security/ip-blocklist/:ip', {
    schema: {
      description: 'IP 차단 해제',
      tags: ['security'],
      params: { type: 'object' as const, required: ['ip'], properties: { ip: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, removeIpBlocklistHandler);

  // FR-P15.4: 보안 이벤트 알림
  app.get('/security/alerts', {
    schema: {
      description: '보안 이벤트 알림 목록',
      tags: ['security'],
      querystring: { type: 'object' as const, properties: { severity: { type: 'string' as const }, page: { type: 'integer' as const, minimum: 1, default: 1 }, limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, securityAlertsHandler);
}
