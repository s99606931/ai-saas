// 사용자 서비스 E2E 통합 테스트 -- Round 4
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.3, FR-E2E.5
// CSAP: D-08-05 테넌트 격리, D-10 보안 헤더

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('user-service E2E -- 관측성 및 보안 (FR-E2E.3)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // 사용자 CRUD 시뮬레이션
  const users = new Map<string, { id: string; name: string; email: string; tenantId: string; role: string }>();

  app.get('/health', async () => ({ status: 'ok', service: 'user-service' }));

  app.post('/users', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    const body = req.body as { name: string; email: string; role?: string };
    const id = `u-${Date.now()}`;
    const user = { id, name: body.name, email: body.email, tenantId, role: body.role ?? 'USER' };
    users.set(id, user);
    return { success: true, data: user };
  });

  app.get('/users', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    const tenantUsers = Array.from(users.values()).filter((u) => u.tenantId === tenantId);
    return { success: true, data: { users: tenantUsers, total: tenantUsers.length } };
  });

  app.get('/users/:id', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    const { id } = req.params as { id: string };
    const user = users.get(id);
    if (!user || user.tenantId !== tenantId) {
      await reply.status(404).send({ error: 'NOT_FOUND' });
      return;
    }
    return { success: true, data: user };
  });

  beforeEach(() => {
    users.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  // X-Response-Time

  it('모든 엔드포인트에 X-Response-Time 포함', async () => {
    const endpoints = [
      { method: 'GET' as const, url: '/health' },
      { method: 'GET' as const, url: '/users', headers: { 'x-tenant-id': 't1' } },
      { method: 'POST' as const, url: '/users', headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' }, payload: { name: 'A', email: 'a@b.c' } },
    ];

    for (const ep of endpoints) {
      const res = await app.inject(ep);
      expect(res.headers['x-response-time']).toBeDefined();
      expect(res.headers['x-response-time']).toMatch(/^\d+\.\d+ms$/);
    }
  });

  // 테넌트 격리

  it('테넌트 A 사용자는 테넌트 B에서 조회 불가 (CSAP D-08-05)', async () => {
    // 테넌트 A에 사용자 생성
    const createRes = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-tenant-id': 'tenant-A', 'content-type': 'application/json' },
      payload: { name: '김철수', email: 'kim@a.com' },
    });
    const userId = createRes.json().data.id;

    // 테넌트 B로 조회 -> 404
    const res = await app.inject({
      method: 'GET',
      url: `/users/${userId}`,
      headers: { 'x-tenant-id': 'tenant-B' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('테넌트 A 목록에 테넌트 B 사용자 미포함', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-tenant-id': 'tenant-A', 'content-type': 'application/json' },
      payload: { name: 'A User', email: 'a@test.com' },
    });
    await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-tenant-id': 'tenant-B', 'content-type': 'application/json' },
      payload: { name: 'B User', email: 'b@test.com' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { 'x-tenant-id': 'tenant-A' },
    });
    expect(res.json().data.total).toBe(1);
    expect(res.json().data.users[0].name).toBe('A User');
  });

  // RBAC 기본 패턴

  it('사용자 생성 시 기본 역할은 USER', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { name: '테스트', email: 'test@test.com' },
    });
    expect(res.json().data.role).toBe('USER');
  });

  it('역할 지정 시 해당 역할로 생성', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { name: '관리자', email: 'admin@test.com', role: 'TENANT_ADMIN' },
    });
    expect(res.json().data.role).toBe('TENANT_ADMIN');
  });

  it('X-Tenant-Id 미포함 시 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
    });
    expect(res.statusCode).toBe(400);
  });
});
