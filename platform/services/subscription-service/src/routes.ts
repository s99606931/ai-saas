// 구독 서비스 라우트
// Design Ref: DESIGN-MTU-P07, SVC-SUB-R1 DESIGN
// Plan SC: FR-P07.1~FR-P07.5, FR-SUB.1~FR-SUB.4

import type { FastifyInstance } from 'fastify';
import {
  listPlansHandler,
  createPlanHandler,
  updatePlanHandler,
  subscribeHandler,
  getTenantSubscriptionHandler,
  upgradeHandler,
  downgradeHandler,
  cancelHandler,
} from './handlers/subscription.handler.js';
import { expiringSubscriptionsHandler, subscriptionStatsHandler } from './handlers/subscription-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // C-03 수정 (CSAP D-08): 서비스 간 내부 인증
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
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

  // FR-SUB.1: Rate Limiting (Design Ref: SVC-SUB-R1 DESIGN)
  const readLimiter = createRateLimiter(100, 60, 'rl:sub:read');
  const writeLimiter = createRateLimiter(20, 60, 'rl:sub:write');
  const cancelLimiter = createRateLimiter(5, 300, 'rl:sub:cancel');

  // 정적 경로 우선 등록
  // FR-SUB.3: 구독 만료 임박 조회
  app.get('/subscription/expiring', { preHandler: readLimiter }, expiringSubscriptionsHandler as never);

  // FR-SUB.4: 구독 통계
  app.get('/subscription/stats', { preHandler: readLimiter }, subscriptionStatsHandler as never);

  // FR-P07.1: 플랜 목록
  app.get('/subscription/plans', { preHandler: readLimiter }, listPlansHandler as never);

  // FR-P07.1 + FR-SUB.2: 플랜 생성 (감사 로그 포함)
  app.post('/subscription/plans', { preHandler: writeLimiter }, createPlanHandler as never);

  // FR-P07.1 + FR-SUB.2: 플랜 수정 (감사 로그 포함)
  app.put('/subscription/plans/:id', { preHandler: writeLimiter }, updatePlanHandler as never);

  // FR-P07.2: 구독 생성
  app.post('/subscription/subscribe', { preHandler: writeLimiter }, subscribeHandler as never);

  // FR-P07.2: 테넌트 구독 조회
  app.get('/subscription/tenants/:tenantId', { preHandler: readLimiter }, getTenantSubscriptionHandler as never);

  // FR-P07.4: 구독 업그레이드
  app.put('/subscription/:id/upgrade', { preHandler: writeLimiter }, upgradeHandler as never);

  // FR-P07.4: 구독 다운그레이드
  app.put('/subscription/:id/downgrade', { preHandler: writeLimiter }, downgradeHandler as never);

  // FR-P07.2: 구독 취소
  app.post('/subscription/:id/cancel', { preHandler: cancelLimiter }, cancelHandler as never);
}
