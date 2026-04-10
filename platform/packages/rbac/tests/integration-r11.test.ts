// Round 11 통합 테스트: rbacPlugin 서비스 통합 검증
// Design Ref: SVC-INTEGRATE-R11 Plan
// Plan SC: FR-INT.3, FR-INT.6
// CSAP: D-08 접근 통제, D-06 감사 로그

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { rbacPlugin, requirePermission, requireAnyPermission } from '../src/index.js';

// ══════════════════════════════════════════════════════════════
// T-INT.3: rbacPlugin 서비스 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.3: rbacPlugin 서비스 통합', () => {
  let app: FastifyInstance;
  const auditLogs: unknown[] = [];

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(rbacPlugin, {
      auditLogger: (event) => {
        auditLogs.push(event);
      },
    });

    // 단일 권한 필요 라우트
    app.get('/admin/tenants', {
      preHandler: requirePermission('tenant:read'),
    }, async () => {
      return { success: true, data: [] };
    });

    // 다중 권한 필요 라우트 (OR)
    app.get('/admin/manage', {
      preHandler: requireAnyPermission('security:manage', 'tenant:update'),
    }, async () => {
      return { success: true };
    });

    // self 권한 검증 라우트
    app.put('/users/:userId', {
      preHandler: requirePermission('user:update', { targetUserIdParam: 'userId' }),
    }, async () => {
      return { success: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rbac decorator가 등록된다', () => {
    expect(app.rbac).toBeDefined();
    expect(typeof app.rbac.checkPermission).toBe('function');
    expect(typeof app.rbac.isValidRole).toBe('function');
  });

  it('인증 정보 없는 요청에 401을 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/tenants' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('ADMIN 역할로 tenant:read 접근이 허용된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: {
        'x-user-id': 'user-001',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('VIEWER 역할로 tenant:read 접근이 허용된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: {
        'x-user-id': 'user-002',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'VIEWER',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('USER 역할로 security:manage 접근이 거부된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/manage',
      headers: {
        'x-user-id': 'user-003',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'USER',
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('SUPER_ADMIN 역할로 security:manage 접근이 허용된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/manage',
      headers: {
        'x-user-id': 'user-admin',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'SUPER_ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('ADMIN 역할로 tenant:update (OR) 접근이 허용된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/manage',
      headers: {
        'x-user-id': 'admin-user',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'ADMIN',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('USER 역할이 본인 데이터만 수정할 수 있다 (self 권한)', async () => {
    // 본인 수정 -- 허용
    const res1 = await app.inject({
      method: 'PUT',
      url: '/users/user-004',
      headers: {
        'x-user-id': 'user-004',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'USER',
      },
      payload: { name: 'Updated' },
    });
    expect(res1.statusCode).toBe(200);

    // 타인 수정 -- 거부
    const res2 = await app.inject({
      method: 'PUT',
      url: '/users/user-005',
      headers: {
        'x-user-id': 'user-004',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'USER',
      },
      payload: { name: 'Hacked' },
    });
    expect(res2.statusCode).toBe(403);
  });

  it('권한 거부 시 감사 로그가 기록된다 (CSAP D-06)', async () => {
    const prevLength = auditLogs.length;
    // requirePermission 미들웨어가 적용된 라우트에서 권한 거부 확인
    // VIEWER 역할은 tenant:read 권한이 있으므로 별도의 쓰기 전용 라우트가 필요
    // 대신 user:update (self) 라우트에서 타인 수정 시 거부 + 감사 로그 확인
    await app.inject({
      method: 'PUT',
      url: '/users/other-user',
      headers: {
        'x-user-id': 'user-audit-test',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'USER',
      },
      payload: { name: 'Test' },
    });
    // requirePermission 미들웨어가 감사 로거를 호출함
    expect(auditLogs.length).toBeGreaterThan(prevLength);
  });

  it('유효하지 않은 역할은 컨텍스트가 설정되지 않는다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
      headers: {
        'x-user-id': 'user-bad',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'INVALID_ROLE',
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
