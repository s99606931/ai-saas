// 테넌트 관리 라우트
// Design Ref: DESIGN-MTU-P03 API 설계
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  listTenantsHandler,
  getTenantHandler,
  createTenantHandler,
  updateTenantHandler,
  updateTenantStatusHandler,
  deleteTenantHandler,
  getTenantConfigHandler,
  updateTenantConfigHandler,
} from './handlers/tenant.handler.js';
import { getTenantUsageHandler } from './handlers/tenant-usage.handler.js';
import { searchTenantsHandler, tenantStatsHandler } from './handlers/tenant-stats.handler.js';
import { createRateLimiter } from '@public-saas/rate-limit';

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
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

  // CSAP D-08-06: Rate Limiting (읽기/쓰기 분리)
  const readLimiter = createRateLimiter(100, 60, 'rl:tenant:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:tenant:write');

  // FR-TENANT.6: 테넌트 통계 (정적 라우트 우선 등록)
  app.get('/tenants/stats', { preHandler: readLimiter }, tenantStatsHandler as never);

  // FR-TENANT.5: 테넌트 검색 (정적 라우트 우선 등록)
  app.get('/tenants/search', { preHandler: readLimiter }, searchTenantsHandler as never);

  app.get('/tenants', { preHandler: readLimiter }, listTenantsHandler as never);
  app.get('/tenants/:id', { preHandler: readLimiter }, getTenantHandler as never);
  app.post('/tenants', { preHandler: writeLimiter }, createTenantHandler as never);
  app.put('/tenants/:id', { preHandler: writeLimiter }, updateTenantHandler as never);
  app.put('/tenants/:id/status', { preHandler: writeLimiter }, updateTenantStatusHandler as never);
  app.delete('/tenants/:id', { preHandler: writeLimiter }, deleteTenantHandler as never);

  // FR-TENANT.1: 리소스 사용량 조회
  app.get('/tenants/:id/usage', { preHandler: readLimiter }, getTenantUsageHandler as never);

  // FR-TENANT.4: 테넌트 설정 관리
  app.get('/tenants/:id/config', { preHandler: readLimiter }, getTenantConfigHandler as never);
  app.put('/tenants/:id/config', { preHandler: writeLimiter }, updateTenantConfigHandler as never);
}
