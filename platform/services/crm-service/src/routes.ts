// CRM 서비스 라우트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5
// CSAP: D-08-06 Rate Limiting, D-10 네트워크 보안

import type { FastifyInstance } from 'fastify';
import {
  listCustomersHandler,
  getCustomerHandler,
  createCustomerHandler,
  updateCustomerHandler,
  listContactsHandler,
  createContactHandler,
  listContractsHandler,
  createContractHandler,
  updateContractHandler,
  pipelineHandler,
} from './handlers/crm.handler.js';
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

  // CSAP D-08-06: Rate Limiting (읽기/쓰기 분리)
  const readLimiter = createRateLimiter(100, 60, 'rl:crm:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:crm:write');

  // FR-P09.1: 고객사 CRUD
  app.get('/crm/customers', { preHandler: readLimiter }, listCustomersHandler as never);
  app.get('/crm/customers/:id', { preHandler: readLimiter }, getCustomerHandler as never);
  app.post('/crm/customers', { preHandler: writeLimiter }, createCustomerHandler as never);
  app.put('/crm/customers/:id', { preHandler: writeLimiter }, updateCustomerHandler as never);

  // FR-P09.2: 담당자 CRUD
  app.get('/crm/customers/:id/contacts', { preHandler: readLimiter }, listContactsHandler as never);
  app.post('/crm/customers/:id/contacts', { preHandler: writeLimiter }, createContactHandler as never);

  // FR-P09.3: 계약 CRUD
  app.get('/crm/contracts', { preHandler: readLimiter }, listContractsHandler as never);
  app.post('/crm/contracts', { preHandler: writeLimiter }, createContractHandler as never);
  app.put('/crm/contracts/:id', { preHandler: writeLimiter }, updateContractHandler as never);

  // FR-P09.4: 영업 파이프라인
  app.get('/crm/pipeline', { preHandler: readLimiter }, pipelineHandler as never);
}
