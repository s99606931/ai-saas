// 감사 로그 서비스 라우트
// Design Ref: DESIGN-MTU-P13 §2.1

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

  // FR-P13.1: 감사 로그 기록 (append-only)
  app.post('/audit/logs', createAuditLogHandler);

  // FR-P13.3: 감사 로그 조회 (필터, 페이지네이션)
  app.get('/audit/logs', listAuditLogsHandler);

  // FR-P13.2, FR-P13.4: SHA-256 체인 무결성 검증
  app.post('/audit/verify', verifyIntegrityHandler);

  // FR-P13.6: 감사 로그 내보내기 (CSV, JSON)
  app.get('/audit/export', exportAuditLogsHandler);

  // FR-P13.5: 감사 로그 통계 (보존 현황)
  app.get('/audit/stats', auditStatsHandler);

  // FR-P13.5: 보존 정책 현황
  app.get('/audit/retention', retentionStatsHandler);

  // FR-P13.5: 만료 로그 아카이브 처리
  app.post('/audit/retention/cleanup', retentionCleanupHandler);

  // FR-AUDIT.1: 감사 이벤트 집계
  app.get('/audit/analytics', analyticsHandler);

  // FR-AUDIT.2: Top-N 통계
  app.get('/audit/analytics/top-actors', topActorsHandler);
  app.get('/audit/analytics/top-actions', topActionsHandler);
}
