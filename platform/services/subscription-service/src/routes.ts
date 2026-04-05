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
  app.get('/subscription/plans', listPlansHandler);
  app.post('/subscription/plans', createPlanHandler);
  app.put('/subscription/plans/:id', updatePlanHandler);
  app.post('/subscription/subscribe', subscribeHandler);
  app.get('/subscription/tenants/:tenantId', getTenantSubscriptionHandler);
  app.put('/subscription/:id/upgrade', upgradeHandler);
  app.put('/subscription/:id/downgrade', downgradeHandler);
  app.post('/subscription/:id/cancel', cancelHandler);
}
