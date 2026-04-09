// 구독 서비스 라우트
// Design Ref: DESIGN-MTU-P07
// Plan SC: FR-P07.1~FR-P07.5

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

  app.get('/subscription/plans', listPlansHandler);
  app.post('/subscription/plans', createPlanHandler);
  app.put('/subscription/plans/:id', updatePlanHandler);
  app.post('/subscription/subscribe', subscribeHandler);
  app.get('/subscription/tenants/:tenantId', getTenantSubscriptionHandler);
  app.put('/subscription/:id/upgrade', upgradeHandler);
  app.put('/subscription/:id/downgrade', downgradeHandler);
  app.post('/subscription/:id/cancel', cancelHandler);
}
