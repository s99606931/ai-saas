// 보안 모니터링 서비스 라우트
// Design Ref: DESIGN-MTU-P15 §2, SVC-SECMON-R1 DESIGN
// Plan SC: FR-P15.1~FR-P15.4, FR-SECMON.1~FR-SECMON.5

import type { FastifyInstance } from 'fastify';
import {
  loginFailuresHandler,
  anomaliesHandler,
  getBlocklistHandler,
  addBlocklistHandler,
  removeBlocklistHandler,
  alertsHandler,
  acknowledgeAlertHandler,
  alertsSummaryHandler,
} from './handlers/security.handler.js';
import { loginFailureTrendHandler, securityEventStatsHandler } from './handlers/secmon-analytics.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const successResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
} as const;

const errorResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
} as const;

const idParam = {
  type: 'object' as const, required: ['id'] as const, properties: { id: { type: 'string' as const } },
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

  // FR-SECMON.1: Rate Limiting (Design Ref: SVC-SECMON-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:secmon:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:secmon:write');

  // FR-P15.1: 로그인 실패 패턴 탐지
  app.get('/security/login-failures', {
    schema: {
      description: '로그인 실패 패턴 탐지',
      tags: ['security-monitor'],
      querystring: { type: 'object' as const, properties: { hours: { type: 'integer' as const, minimum: 1, maximum: 168, default: 24 }, threshold: { type: 'integer' as const, minimum: 1, default: 5 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, loginFailuresHandler as never);

  // FR-P15.2: 이상 접근 패턴 탐지
  app.get('/security/anomalies', {
    schema: { description: '이상 접근 패턴 탐지', tags: ['security-monitor'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, anomaliesHandler as never);

  // FR-P15.3: IP 차단 목록 관리
  app.get('/security/ip-blocklist', {
    schema: { description: 'IP 차단 목록 조회', tags: ['security-monitor'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, getBlocklistHandler as never);
  app.post('/security/ip-blocklist', {
    schema: {
      description: 'IP 차단 등록',
      tags: ['security-monitor'],
      body: { type: 'object' as const, required: ['ip'], properties: { ip: { type: 'string' as const }, reason: { type: 'string' as const }, expiresAt: { type: 'string' as const, format: 'date-time' } } },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, addBlocklistHandler as never);
  app.delete('/security/ip-blocklist/:ip', {
    schema: {
      description: 'IP 차단 해제',
      tags: ['security-monitor'],
      params: { type: 'object' as const, required: ['ip'], properties: { ip: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse, 404: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, removeBlocklistHandler as never);

  // FR-P15.4: 보안 이벤트 알림
  app.get('/security/alerts', {
    schema: {
      description: '보안 이벤트 알림 목록',
      tags: ['security-monitor'],
      querystring: { type: 'object' as const, properties: { severity: { type: 'string' as const, enum: ['low', 'medium', 'high', 'critical'] }, page: { type: 'integer' as const, minimum: 1, default: 1 }, limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, alertsHandler as never);

  // FR-SECMON.2: 알림 확인
  app.put('/security/alerts/:id/acknowledge', {
    schema: { description: '보안 알림 확인 처리', tags: ['security-monitor'], params: idParam, response: { 200: successResponse, 401: errorResponse, 404: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: writeLimiter,
  }, acknowledgeAlertHandler as never);

  // FR-SECMON.3: 알림 심각도 대시보드
  app.get('/security/alerts/summary', {
    schema: { description: '보안 알림 심각도별 대시보드', tags: ['security-monitor'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, alertsSummaryHandler as never);

  // FR-SECMON.6: 로그인 실패 추이
  app.get('/security/login-failures/trend', {
    schema: {
      description: '로그인 실패 추이',
      tags: ['security-monitor'],
      querystring: { type: 'object' as const, properties: { days: { type: 'integer' as const, minimum: 1, maximum: 90, default: 7 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, loginFailureTrendHandler as never);

  // FR-SECMON.7: 보안 이벤트 통계
  app.get('/security/events/stats', {
    schema: { description: '보안 이벤트 통계', tags: ['security-monitor'], response: { 200: successResponse, 401: errorResponse }, security: [{ bearerAuth: [] }] },
    preHandler: readLimiter,
  }, securityEventStatsHandler as never);
}
