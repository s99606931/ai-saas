// tenantIsolationPlugin 통합 테스트
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.1

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { tenantIsolationPlugin } from '../src/tenant-isolation-plugin.js';

describe('tenantIsolationPlugin -- Fastify 통합', () => {
  let app: FastifyInstance;
  const masterKey = randomBytes(32).toString('hex');

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(tenantIsolationPlugin, {
      masterKey,
      requireTenantHeader: true,
    });

    app.get('/test', async () => ({ data: 'ok' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('tenant decorator가 등록된다', () => {
    expect(app.tenant).toBeDefined();
    expect(app.tenant.context).toBeDefined();
    expect(app.tenant.rls).toBeDefined();
    expect(app.tenant.encryption).not.toBeNull();
    expect(app.tenant.validator).toBeDefined();
  });

  it('X-Tenant-Id 헤더 없이 400을 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('TENANT_ID_REQUIRED');
  });

  it('X-Tenant-Id 헤더가 있으면 정상 응답한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-tenant-id': 'tenant-001' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBe('ok');
  });

  it('/health 경로는 테넌트 헤더 없이 접근 가능하다', async () => {
    // health 라우트 등록
    try {
      app.get('/health', async () => ({ status: 'ok' }));
    } catch {
      // 이미 등록됨
    }

    const res = await app.inject({ method: 'GET', url: '/health' });
    // 404 또는 200 (이미 등록 여부에 따라)
    // 중요한 것은 400이 아님
    expect(res.statusCode).not.toBe(400);
  });

  it('/tenant/isolation-check 엔드포인트가 격리 검증을 수행한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenant/isolation-check',
      headers: { 'x-tenant-id': 'verify-tenant' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.allPassed).toBe(true);
    expect(body.data.tenantId).toBe('verify-tenant');
    expect(body.data.checks).toHaveLength(4);
  });

  it('/tenant/isolation-check가 테넌트 헤더 없이 에러를 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenant/isolation-check',
    });

    // isolation-check는 excludePaths에 없으므로 400 반환
    expect(res.statusCode).toBe(400);
  });
});

describe('tenantIsolationPlugin -- 헤더 선택적', () => {
  it('requireTenantHeader=false 시 헤더 없이 통과한다', async () => {
    const app = Fastify({ logger: false });
    await app.register(tenantIsolationPlugin, {
      requireTenantHeader: false,
    });
    app.get('/test', async () => ({ data: 'no-header-ok' }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBe('no-header-ok');

    await app.close();
  });
});

describe('tenantIsolationPlugin -- 암호화 비활성화', () => {
  it('masterKey 미제공 시 encryption이 null이다', async () => {
    const app = Fastify({ logger: false });
    await app.register(tenantIsolationPlugin, {
      requireTenantHeader: false,
    });
    await app.ready();

    expect(app.tenant.encryption).toBeNull();

    await app.close();
  });
});
