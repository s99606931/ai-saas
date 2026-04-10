// 감사 로그 서비스 라우트
// Design Ref: DESIGN-MTU-P13 §2.1
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  createAuditLogHandler,
  listAuditLogsHandler,
  verifyIntegrityHandler,
  exportAuditLogsHandler,
  auditStatsHandler,
} from './handlers/audit.handler.js';
import { retentionStatsHandler, retentionCleanupHandler } from './handlers/retention.handler.js';
import { analyticsHandler, topActorsHandler, topActionsHandler } from './handlers/analytics.handler.js';
import { eventTrendHandler, anomalyDetectionHandler } from './handlers/trend.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

// OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
const paginationQuery = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer' as const, minimum: 1, default: 1 },
    limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
  },
} as const;

const successResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
} as const;

const errorResponse = {
  type: 'object' as const,
  properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
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

  // CSAP D-08-06: Rate Limiting (감사 로그 기록은 내부 서비스 호출이므로 넉넉하게)
  const readLimiter = createRateLimiter(100, 60, 'rl:audit:read');
  const writeLimiter = createRateLimiter(200, 60, 'rl:audit:write');

  // FR-P13.1: 감사 로그 기록 (append-only)
  app.post('/audit/logs', {
    schema: {
      description: '감사 로그 기록 (append-only, CSAP D-06)',
      tags: ['audit'],
      body: {
        type: 'object' as const,
        required: ['action'],
        properties: {
          tenantId: { type: 'string' as const },
          actorId: { type: 'string' as const },
          action: { type: 'string' as const, minLength: 1 },
          target: { type: 'string' as const },
          targetType: { type: 'string' as const },
          ip: { type: 'string' as const },
          userAgent: { type: 'string' as const },
          metadata: { type: 'object' as const },
        },
      },
      response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, createAuditLogHandler);

  // FR-P13.3: 감사 로그 조회 (필터, 페이지네이션)
  app.get('/audit/logs', {
    schema: {
      description: '감사 로그 조회 (필터, 커서 페이지네이션)',
      tags: ['audit'],
      querystring: {
        type: 'object' as const,
        properties: {
          tenantId: { type: 'string' as const },
          actorId: { type: 'string' as const },
          action: { type: 'string' as const },
          targetType: { type: 'string' as const },
          fromDate: { type: 'string' as const, format: 'date-time' },
          toDate: { type: 'string' as const, format: 'date-time' },
          cursor: { type: 'string' as const },
          limit: { type: 'integer' as const, minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, listAuditLogsHandler);

  // FR-P13.2, FR-P13.4: SHA-256 체인 무결성 검증
  app.post('/audit/verify', {
    schema: {
      description: 'SHA-256 체인 무결성 검증 (CSAP D-06)',
      tags: ['audit'],
      body: {
        type: 'object' as const,
        properties: {
          tenantId: { type: 'string' as const },
          fromDate: { type: 'string' as const, format: 'date-time' },
          toDate: { type: 'string' as const, format: 'date-time' },
        },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, verifyIntegrityHandler);

  // FR-P13.6: 감사 로그 내보내기 (CSV, JSON)
  app.get('/audit/export', {
    schema: {
      description: '감사 로그 내보내기 (CSV/JSON)',
      tags: ['audit'],
      querystring: {
        type: 'object' as const,
        properties: {
          tenantId: { type: 'string' as const },
          actorId: { type: 'string' as const },
          action: { type: 'string' as const },
          fromDate: { type: 'string' as const, format: 'date-time' },
          toDate: { type: 'string' as const, format: 'date-time' },
          format: { type: 'string' as const, enum: ['csv', 'json'], default: 'json' },
        },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, exportAuditLogsHandler);

  // FR-P13.5: 감사 로그 통계 (보존 현황)
  app.get('/audit/stats', {
    schema: {
      description: '감사 로그 통계 (보존 현황)',
      tags: ['audit'],
      querystring: { type: 'object' as const, properties: { tenantId: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, auditStatsHandler);

  // FR-P13.5: 보존 정책 현황
  app.get('/audit/retention', {
    schema: {
      description: '보존 정책 현황 조회',
      tags: ['audit'],
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, retentionStatsHandler);

  // FR-P13.5: 만료 로그 아카이브 처리
  app.post('/audit/retention/cleanup', {
    schema: {
      description: '만료 로그 아카이브 처리',
      tags: ['audit'],
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: writeLimiter,
  }, retentionCleanupHandler);

  // FR-AUDIT.1: 감사 이벤트 집계
  app.get('/audit/analytics', {
    schema: {
      description: '감사 이벤트 집계',
      tags: ['audit'],
      querystring: paginationQuery,
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, analyticsHandler);

  // FR-AUDIT.2: Top-N 통계
  app.get('/audit/analytics/top-actors', {
    schema: {
      description: 'Top-N 행위자 통계',
      tags: ['audit'],
      querystring: { type: 'object' as const, properties: { limit: { type: 'integer' as const, minimum: 1, maximum: 50, default: 10 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, topActorsHandler);
  app.get('/audit/analytics/top-actions', {
    schema: {
      description: 'Top-N 행위 유형 통계',
      tags: ['audit'],
      querystring: { type: 'object' as const, properties: { limit: { type: 'integer' as const, minimum: 1, maximum: 50, default: 10 } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, topActionsHandler);

  // FR-AUDIT.3: 일별 이벤트 추이
  app.get('/audit/analytics/trend', {
    schema: {
      description: '일별 감사 이벤트 추이',
      tags: ['audit'],
      querystring: {
        type: 'object' as const,
        properties: {
          days: { type: 'integer' as const, minimum: 1, maximum: 365, default: 30 },
          tenantId: { type: 'string' as const },
        },
      },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, eventTrendHandler as never);

  // FR-AUDIT.4: 이상 행위 탐지
  app.get('/audit/analytics/anomalies', {
    schema: {
      description: '이상 행위 탐지 결과',
      tags: ['audit'],
      querystring: { type: 'object' as const, properties: { tenantId: { type: 'string' as const } } },
      response: { 200: successResponse, 401: errorResponse },
      security: [{ bearerAuth: [] }],
    },
    preHandler: readLimiter,
  }, anomalyDetectionHandler as never);
}
