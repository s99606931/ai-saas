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

  // FR-SECMON.1: Rate Limiting (Design Ref: SVC-SECMON-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:secmon:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:secmon:write');

  // FR-P15.1: 로그인 실패 패턴 탐지
  app.get('/security/login-failures', { preHandler: readLimiter }, loginFailuresHandler as never);

  // FR-P15.2: 이상 접근 패턴 탐지
  app.get('/security/anomalies', { preHandler: readLimiter }, anomaliesHandler as never);

  // FR-P15.3: IP 차단 목록 관리
  app.get('/security/ip-blocklist', { preHandler: readLimiter }, getBlocklistHandler as never);
  app.post('/security/ip-blocklist', { preHandler: writeLimiter }, addBlocklistHandler as never);
  app.delete('/security/ip-blocklist/:ip', { preHandler: writeLimiter }, removeBlocklistHandler as never);

  // FR-P15.4: 보안 이벤트 알림
  app.get('/security/alerts', { preHandler: readLimiter }, alertsHandler as never);

  // FR-SECMON.2: 알림 확인
  app.put('/security/alerts/:id/acknowledge', { preHandler: writeLimiter }, acknowledgeAlertHandler as never);

  // FR-SECMON.3: 알림 심각도 대시보드
  app.get('/security/alerts/summary', { preHandler: readLimiter }, alertsSummaryHandler as never);

  // FR-SECMON.6: 로그인 실패 추이
  app.get('/security/login-failures/trend', { preHandler: readLimiter }, loginFailureTrendHandler as never);

  // FR-SECMON.7: 보안 이벤트 통계
  app.get('/security/events/stats', { preHandler: readLimiter }, securityEventStatsHandler as never);
}
