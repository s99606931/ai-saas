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

export async function registerRoutes(app: FastifyInstance): Promise<void> {
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
}
