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

  // OpenAPI JSON Schema 정의 (CSAP D-12: API 문서화)
  const idParam = { type: 'object' as const, properties: { id: { type: 'string' as const, format: 'uuid' } } };
  const tenantResponse = { type: 'object' as const, properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } } };
  const listResponse = { type: 'object' as const, properties: { success: { type: 'boolean' as const }, data: { type: 'array' as const, items: { type: 'object' as const } } } };

  // FR-TENANT.6: 테넌트 통계 (정적 라우트 우선 등록)
  app.get('/tenants/stats', {
    schema: { description: '테넌트 통계 (CSAP D-06)', tags: ['tenants'], response: { 200: tenantResponse } },
    preHandler: readLimiter,
  }, tenantStatsHandler as never);

  // FR-TENANT.5: 테넌트 검색 (정적 라우트 우선 등록)
  app.get('/tenants/search', {
    schema: { description: '테넌트 검색', tags: ['tenants'], querystring: { type: 'object' as const, properties: { q: { type: 'string' as const }, status: { type: 'string' as const } } }, response: { 200: listResponse } },
    preHandler: readLimiter,
  }, searchTenantsHandler as never);

  app.get('/tenants', {
    schema: { description: '테넌트 목록 조회', tags: ['tenants'], querystring: { type: 'object' as const, properties: { page: { type: 'integer' as const }, limit: { type: 'integer' as const } } }, response: { 200: listResponse } },
    preHandler: readLimiter,
  }, listTenantsHandler as never);

  app.get('/tenants/:id', {
    schema: { description: '테넌트 상세 조회', tags: ['tenants'], params: idParam, response: { 200: tenantResponse } },
    preHandler: readLimiter,
  }, getTenantHandler as never);

  app.post('/tenants', {
    schema: { description: '테넌트 생성 (CSAP D-08)', tags: ['tenants'], body: { type: 'object' as const, required: ['name', 'slug', 'plan'] as const, properties: { name: { type: 'string' as const }, slug: { type: 'string' as const }, plan: { type: 'string' as const, enum: ['basic', 'standard', 'enterprise'] } } }, response: { 201: tenantResponse } },
    preHandler: writeLimiter,
  }, createTenantHandler as never);

  app.put('/tenants/:id', {
    schema: { description: '테넌트 수정', tags: ['tenants'], params: idParam, body: { type: 'object' as const, properties: { name: { type: 'string' as const }, plan: { type: 'string' as const } } }, response: { 200: tenantResponse } },
    preHandler: writeLimiter,
  }, updateTenantHandler as never);

  app.put('/tenants/:id/status', {
    schema: { description: '테넌트 상태 변경', tags: ['tenants'], params: idParam, body: { type: 'object' as const, required: ['status'] as const, properties: { status: { type: 'string' as const, enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] } } }, response: { 200: tenantResponse } },
    preHandler: writeLimiter,
  }, updateTenantStatusHandler as never);

  app.delete('/tenants/:id', {
    schema: { description: '테넌트 삭제 (CSAP D-08)', tags: ['tenants'], params: idParam, response: { 200: tenantResponse } },
    preHandler: writeLimiter,
  }, deleteTenantHandler as never);

  // FR-TENANT.1: 리소스 사용량 조회
  app.get('/tenants/:id/usage', {
    schema: { description: '테넌트 리소스 사용량 조회', tags: ['tenants'], params: idParam, response: { 200: tenantResponse } },
    preHandler: readLimiter,
  }, getTenantUsageHandler as never);

  // FR-TENANT.4: 테넌트 설정 관리
  app.get('/tenants/:id/config', {
    schema: { description: '테넌트 설정 조회', tags: ['tenants'], params: idParam, response: { 200: tenantResponse } },
    preHandler: readLimiter,
  }, getTenantConfigHandler as never);

  app.put('/tenants/:id/config', {
    schema: { description: '테넌트 설정 수정', tags: ['tenants'], params: idParam, body: { type: 'object' as const }, response: { 200: tenantResponse } },
    preHandler: writeLimiter,
  }, updateTenantConfigHandler as never);
}
