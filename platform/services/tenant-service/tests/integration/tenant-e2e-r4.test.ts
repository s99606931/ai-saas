// 테넌트 서비스 E2E 통합 테스트 -- Round 4
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.3, FR-E2E.5
// CSAP: N2SF N-03 격리 아키텍처

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('tenant-service E2E -- 테넌트 격리 + 관측성', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  const tenants = new Map<string, { id: string; name: string; plan: string; status: string }>();

  app.get('/health', async () => ({ status: 'ok', service: 'tenant-service' }));

  app.post('/tenants', async (req) => {
    const body = req.body as { name: string; plan?: string };
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tenant = { id, name: body.name, plan: body.plan ?? 'BASIC', status: 'ACTIVE' };
    tenants.set(id, tenant);
    return { success: true, data: tenant };
  });

  app.get('/tenants', async () => {
    return {
      success: true,
      data: {
        tenants: Array.from(tenants.values()),
        total: tenants.size,
      },
    };
  });

  app.get('/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = tenants.get(id);
    if (!tenant) {
      await reply.status(404).send({ error: 'NOT_FOUND' });
      return;
    }
    return { success: true, data: tenant };
  });

  app.put('/tenants/:id/suspend', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = tenants.get(id);
    if (!tenant) {
      await reply.status(404).send({ error: 'NOT_FOUND' });
      return;
    }
    tenant.status = 'SUSPENDED';
    return { success: true, data: tenant };
  });

  beforeEach(() => {
    tenants.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('헬스체크에 X-Response-Time 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-response-time']).toBeDefined();
  });

  it('테넌트 생성 -> 조회 플로우', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { 'content-type': 'application/json' },
      payload: { name: '공공기관 A', plan: 'ENTERPRISE' },
    });
    expect(createRes.statusCode).toBe(200);
    const tenantId = createRes.json().data.id;

    const getRes = await app.inject({
      method: 'GET',
      url: `/tenants/${tenantId}`,
    });
    expect(getRes.json().data.name).toBe('공공기관 A');
    expect(getRes.json().data.plan).toBe('ENTERPRISE');
  });

  it('테넌트 일시 중지 후 상태 변경 확인', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { 'content-type': 'application/json' },
      payload: { name: '테스트 기관' },
    });
    const tenantId = createRes.json().data.id;

    const suspendRes = await app.inject({
      method: 'PUT',
      url: `/tenants/${tenantId}/suspend`,
    });
    expect(suspendRes.json().data.status).toBe('SUSPENDED');
  });

  it('미존재 테넌트 조회 시 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/tenants/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('기본 플랜은 BASIC', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { 'content-type': 'application/json' },
      payload: { name: '기본 기관' },
    });
    expect(res.json().data.plan).toBe('BASIC');
  });

  it('모든 응답에 X-Response-Time 포함', async () => {
    await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'RT Test' },
    });

    const listRes = await app.inject({ method: 'GET', url: '/tenants' });
    expect(listRes.headers['x-response-time']).toBeDefined();
    expect(listRes.headers['x-response-time']).toMatch(/^\d+\.\d+ms$/);
  });
});
