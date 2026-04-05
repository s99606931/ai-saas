// 테넌트 관리 라우트
// Design Ref: DESIGN-MTU-P03 API 설계

import type { FastifyInstance } from 'fastify';
import {
  listTenantsHandler,
  getTenantHandler,
  createTenantHandler,
  updateTenantHandler,
  updateTenantStatusHandler,
} from './handlers/tenant.handler.js';

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tenants', listTenantsHandler);
  app.get('/tenants/:id', getTenantHandler);
  app.post('/tenants', createTenantHandler);
  app.put('/tenants/:id', updateTenantHandler);
  app.put('/tenants/:id/status', updateTenantStatusHandler);
}
