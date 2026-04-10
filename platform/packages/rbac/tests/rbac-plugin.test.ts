// @public-saas/rbac Fastify 플러그인 통합 테스트
// Design Ref: SVC-RBAC-R8 Plan
// Plan SC: FR-RBAC.4, FR-RBAC.5
// CSAP: D-08 접근 통제, D-06 감사 로그

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { rbacPlugin, requirePermission, requireAnyPermission } from '../src/rbac-plugin.js';

describe('RBAC Fastify 플러그인 -- API 보호 E2E', () => {
  const app = Fastify();

  const auditEvents: Array<{ action: string; actor: string; permission: string; allowed: boolean }> = [];

  app.register(rbacPlugin, {
    auditLogger: (event) => {
      auditEvents.push(event);
    },
  });

  // 테스트용 라우트
  app.get('/tenants', { preHandler: requirePermission('tenant:read') }, async () => {
    return { success: true, data: [{ id: 't-1', name: '테넌트1' }] };
  });

  app.post('/tenants', { preHandler: requirePermission('tenant:create') }, async () => {
    return { success: true, data: { id: 't-new' } };
  });

  app.delete('/tenants/:id', { preHandler: requirePermission('tenant:delete') }, async () => {
    return { success: true, message: '삭제 완료' };
  });

  app.get(
    '/users/:userId',
    { preHandler: requirePermission('user:update', { targetUserIdParam: 'userId' }) },
    async (req) => {
      return { success: true, data: { id: (req.params as { userId: string }).userId } };
    },
  );

  app.get('/security/alerts', { preHandler: requireAnyPermission('security:read', 'security:manage') }, async () => {
    return { success: true, data: [] };
  });

  afterAll(async () => {
    await app.close();
  });

  it('인증 없이 보호된 엔드포인트 접근 시 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/tenants' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('ADMIN이 tenant:read 접근 -- 허용', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: {
        'x-user-id': 'admin-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('ADMIN이 tenant:create 접근 -- 거부 (CSAP D-08)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'admin-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'ADMIN',
      },
      payload: { name: 'test' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(res.json().error.permission).toBe('tenant:create');
  });

  it('SUPER_ADMIN이 tenant:delete 접근 -- 허용', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/tenants/t-1',
      headers: {
        'x-user-id': 'sa-1',
        'x-user-tenant-id': 't-global',
        'x-user-role': 'SUPER_ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('USER가 본인 프로필 수정 -- 허용 (self 권한)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/user-1',
      headers: {
        'x-user-id': 'user-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'USER',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('USER가 타인 프로필 수정 -- 거부 (self 권한 위반)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/user-999',
      headers: {
        'x-user-id': 'user-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'USER',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('VIEWER가 보안 알림 접근 -- 거부 (OR 조건 모두 미충족)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/security/alerts',
      headers: {
        'x-user-id': 'viewer-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'VIEWER',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('ADMIN이 보안 알림 접근 -- 허용 (security:read 보유)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/security/alerts',
      headers: {
        'x-user-id': 'admin-1',
        'x-user-tenant-id': 't-001',
        'x-user-role': 'ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('CSAP D-06: 권한 거부 시 감사 로그 기록', () => {
    const denied = auditEvents.filter((e) => e.action === 'PERMISSION_DENIED');
    expect(denied.length).toBeGreaterThan(0);
    expect(denied[0].allowed).toBe(false);
    expect(denied[0].actor).toBeDefined();
    expect(denied[0].permission).toBeDefined();
  });
});
