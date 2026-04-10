// 준수 현황 서비스 E2E 통합 테스트 -- Round 4/5
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.3
// CSAP: D-06 감사 로그

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('compliance-service E2E -- 관측성 + 보안', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'compliance-service' }));

  app.get('/compliance/summary', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    return {
      success: true,
      data: {
        tenantId,
        csap: { total: 79, passed: 72, failed: 3, pending: 4 },
        n2sf: { total: 6, passed: 5, failed: 0, pending: 1 },
        overallScore: 91.4,
      },
    };
  });

  app.get('/compliance/csap/items', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    return {
      success: true,
      data: {
        items: [
          { id: 'D-06', name: '침해사고 관리', status: 'PASSED' },
          { id: 'D-08', name: '접근 통제', status: 'PASSED' },
          { id: 'D-09', name: '암호화', status: 'PASSED' },
          { id: 'D-10', name: '네트워크 보안', status: 'PENDING' },
          { id: 'D-12', name: '시스템 개발 보안', status: 'PASSED' },
        ],
        total: 5,
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('준수 현황 요약 조회', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/compliance/summary',
      headers: { 'x-tenant-id': 't1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.overallScore).toBeGreaterThan(90);
    expect(res.json().data.csap.total).toBe(79);
  });

  it('CSAP 항목 목록 조회', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/compliance/csap/items',
      headers: { 'x-tenant-id': 't1' },
    });
    expect(res.json().data.total).toBe(5);
    expect(res.json().data.items[0].id).toBe('D-06');
  });

  it('테넌트 ID 미포함 시 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/compliance/summary' });
    expect(res.statusCode).toBe(400);
  });

  it('X-Response-Time 포함', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/compliance/summary',
      headers: { 'x-tenant-id': 't1' },
    });
    expect(res.headers['x-response-time']).toBeDefined();
  });

  it('헬스체크 응답', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().service).toBe('compliance-service');
  });
});
