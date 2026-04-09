// 테넌트 관리 라우트
// Design Ref: DESIGN-MTU-P03 API 설계

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

  app.get('/tenants', listTenantsHandler);
  app.get('/tenants/:id', getTenantHandler);
  app.post('/tenants', createTenantHandler);
  app.put('/tenants/:id', updateTenantHandler);
  app.put('/tenants/:id/status', updateTenantStatusHandler);
  app.delete('/tenants/:id', deleteTenantHandler);

  // FR-TENANT.1: 리소스 사용량 조회
  app.get('/tenants/:id/usage', getTenantUsageHandler);

  // FR-TENANT.4: 테넌트 설정 관리
  app.get('/tenants/:id/config', getTenantConfigHandler);
  app.put('/tenants/:id/config', updateTenantConfigHandler);
}
