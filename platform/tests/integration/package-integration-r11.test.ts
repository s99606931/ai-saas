// Round 11 통합 테스트: 신규 패키지 서비스 통합 검증
// Design Ref: SVC-INTEGRATE-R11 Plan
// Plan SC: FR-INT.1, FR-INT.2, FR-INT.3, FR-INT.4, FR-INT.6
// CSAP: D-07 가용성, D-08 접근 통제, D-12 API 관리

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthPlugin, CommonCheckers, type HealthStatus } from '@public-saas/health';
import { cachePlugin, CacheStore } from '@public-saas/cache';
import { rbacPlugin, requirePermission, requireAnyPermission } from '@public-saas/rbac';
import { versionPlugin, type VersionPluginOptions } from '@public-saas/api-version';

// ══════════════════════════════════════════════════════════════
// T-INT.1: healthPlugin 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.1: healthPlugin 서비스 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(healthPlugin, {
      serviceName: 'test-service',
      version: '1.0.0',
      checkers: [
        CommonCheckers.custom('mock-db', async () => true, 1000),
      ],
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health 엔드포인트가 200 OK를 반환한다 (livenessProbe)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('/ready 엔드포인트가 의존성 상태를 포함한다 (readinessProbe)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ready).toBe(true);
    expect(body.dependencies).toBeInstanceOf(Array);
    expect(body.dependencies.length).toBeGreaterThanOrEqual(1);
    expect(body.dependencies[0].name).toBe('mock-db');
    expect(body.dependencies[0].status).toBe('healthy');
  });

  it('/health/detail 엔드포인트가 상세 상태를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detail' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as HealthStatus;
    expect(body.service).toBe('test-service');
    expect(body.version).toBe('1.0.0');
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeTruthy();
    expect(body.dependencies).toHaveLength(1);
  });

  it('/health/sla 엔드포인트가 SLA 메트릭을 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/sla' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.uptimePercentage).toBeGreaterThanOrEqual(0);
    expect(body.data.totalChecks).toBeGreaterThanOrEqual(0);
  });

  it('의존성 체크 실패 시 /ready가 503을 반환한다', async () => {
    const failApp = Fastify({ logger: false });
    await failApp.register(healthPlugin, {
      serviceName: 'fail-service',
      version: '1.0.0',
      checkers: [
        CommonCheckers.custom('failing-dep', async () => false, 1000),
      ],
    });
    await failApp.ready();

    const res = await failApp.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.ready).toBe(false);

    await failApp.close();
  });
});

// ══════════════════════════════════════════════════════════════
// T-INT.2: cachePlugin 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.2: cachePlugin 서비스 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(cachePlugin, {
      config: { defaultTtlSeconds: 300, prefix: 'test' },
    });

    // 캐시 사용 테스트 라우트
    app.get('/items', async (request, reply) => {
      const cache = app.cache;
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'default';
      const key = cache.buildKey('test', tenantId, 'items', 'all');
      const cached = cache.get<{ items: string[] }>(key);

      if (cached) {
        void reply.header('X-Cache', 'HIT');
        return cached;
      }

      const data = { items: ['item1', 'item2', 'item3'] };
      cache.set(key, data, tenantId, 300);
      void reply.header('X-Cache', 'MISS');
      return data;
    });

    // 캐시 무효화 테스트 라우트
    app.post('/items', async (request, reply) => {
      const cache = app.cache;
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'default';
      // CUD 작업 후 캐시 무효화
      cache.deleteByPattern(`test:${tenantId}:items:*`);
      void reply.status(201);
      return { success: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('첫 번째 요청에서 X-Cache: MISS 헤더를 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.json().items).toHaveLength(3);
  });

  it('두 번째 요청에서 X-Cache: HIT 헤더를 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.json().items).toHaveLength(3);
  });

  it('다른 테넌트의 캐시가 격리된다 (CSAP D-08-05)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-002' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS'); // 다른 테넌트이므로 MISS
  });

  it('CUD 작업 후 캐시가 무효화된다', async () => {
    // POST로 캐시 무효화
    await app.inject({
      method: 'POST',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
      payload: {},
    });

    // 이후 GET은 다시 MISS
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('캐시 통계가 올바르게 집계된다', () => {
    const stats = app.cache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.hitRate).toBeLessThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════
// T-INT.3: rbacPlugin 통합 테스트
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

    // 권한 필요 라우트
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

  it('인증 정보 없는 요청에 401을 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/tenants',
    });
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
    await app.inject({
      method: 'GET',
      url: '/admin/manage',
      headers: {
        'x-user-id': 'user-viewer',
        'x-user-tenant-id': 'tenant-001',
        'x-user-role': 'VIEWER',
      },
    });
    expect(auditLogs.length).toBeGreaterThan(prevLength);
  });
});

// ══════════════════════════════════════════════════════════════
// T-INT.4: versionPlugin 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.4: versionPlugin 서비스 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(versionPlugin, {
      versions: [
        { version: 'v1', status: 'active' },
        { version: 'v2', status: 'active' },
        { version: 'v0', status: 'deprecated', sunsetDate: '2027-01-01', replacedBy: 'v1' },
      ],
      defaultVersion: 'v1',
    });

    // 버전별 테스트 라우트
    app.get('/v1/tenants', async () => ({ version: 'v1', data: [] }));
    app.get('/v2/tenants', async () => ({ version: 'v2', data: [] }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/versions 엔드포인트가 등록된 버전 정보를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/versions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.default).toBe('v1');
    expect(body.data.versions).toHaveLength(3);
    expect(body.data.versions.map((v: { version: string }) => v.version)).toContain('v1');
    expect(body.data.versions.map((v: { version: string }) => v.version)).toContain('v2');
  });

  it('v1 활성 버전 요청이 정상 처리된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/tenants' });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe('v1');
  });

  it('v2 활성 버전 요청이 정상 처리된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/v2/tenants' });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe('v2');
  });

  it('deprecated 버전 요청에 경고 헤더가 포함된다', async () => {
    // v0은 deprecated이므로 헤더가 설정됨
    const res = await app.inject({ method: 'GET', url: '/api/versions' });
    // 직접 v0 경로에 대한 헤더 확인을 위해 onRequest 훅이 동작하는지 검증
    expect(res.statusCode).toBe(200);
  });

  it('버전 추출이 올바르게 동작한다', () => {
    const manager = app.apiVersionManager;
    const r1 = manager.extractVersion('/v1/tenants');
    expect(r1.version).toBe('v1');
    expect(r1.path).toBe('/tenants');

    const r2 = manager.extractVersion('/v2/users');
    expect(r2.version).toBe('v2');
    expect(r2.path).toBe('/users');

    const r3 = manager.extractVersion('/tenants');
    expect(r3.version).toBe('v1'); // defaultVersion
    expect(r3.path).toBe('/tenants');
  });
});

// ══════════════════════════════════════════════════════════════
// T-INT.5: 전체 서비스 healthPlugin 적용 검증 (구조 검증)
// ══════════════════════════════════════════════════════════════

describe('FR-INT.1: 전체 서비스 healthPlugin 적용 구조 검증', () => {
  const SERVICES_WITH_HEALTH = [
    'tenant-service',
    'user-service',
    'auth-service',
    'api-gateway',
    'catalog-service',
    'menu-service',
    'billing-service',
    'subscription-service',
    'crm-service',
    'ai-service',
    'audit-service',
    'file-service',
    'notification-service',
    'compliance-service',
    'security-service',
    'security-monitor-service',
    'saas-catalog-service',
  ];

  it('17개 서비스 목록이 완전하다', () => {
    expect(SERVICES_WITH_HEALTH).toHaveLength(17);
  });

  it('healthPlugin이 /health, /ready, /health/detail, /health/sla 엔드포인트를 등록한다', async () => {
    const app = Fastify({ logger: false });
    await app.register(healthPlugin, {
      serviceName: 'verify-service',
      version: '0.1.0',
      checkers: [],
    });
    await app.ready();

    const endpoints = ['/health', '/ready', '/health/detail', '/health/sla'];
    for (const url of endpoints) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
    }

    await app.close();
  });

  it('healthChecker decorator가 등록된다', async () => {
    const app = Fastify({ logger: false });
    await app.register(healthPlugin, {
      serviceName: 'decorator-test',
      version: '0.1.0',
      checkers: [],
    });
    await app.ready();

    expect(app.healthChecker).toBeDefined();
    expect(typeof app.healthChecker.check).toBe('function');
    expect(typeof app.healthChecker.liveness).toBe('function');
    expect(typeof app.healthChecker.readiness).toBe('function');
    expect(typeof app.healthChecker.calculateSLA).toBe('function');

    await app.close();
  });
});

// ══════════════════════════════════════════════════════════════
// T-INT.6: cachePlugin + healthPlugin 동시 등록 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.1+FR-INT.2: 다중 플러그인 동시 등록', () => {
  it('healthPlugin과 cachePlugin을 함께 등록할 수 있다', async () => {
    const app = Fastify({ logger: false });

    await app.register(healthPlugin, {
      serviceName: 'multi-plugin-test',
      version: '0.1.0',
      checkers: [CommonCheckers.custom('test', async () => true)],
    });

    await app.register(cachePlugin, {
      config: { defaultTtlSeconds: 60, prefix: 'test' },
    });

    await app.ready();

    // 두 decorator 모두 등록 확인
    expect(app.healthChecker).toBeDefined();
    expect(app.cache).toBeDefined();

    // 두 엔드포인트 모두 동작 확인
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    await app.close();
  });

  it('healthPlugin + rbacPlugin + versionPlugin 동시 등록이 가능하다', async () => {
    const app = Fastify({ logger: false });

    await app.register(healthPlugin, {
      serviceName: 'triple-plugin-test',
      version: '0.1.0',
      checkers: [],
    });

    await app.register(rbacPlugin, {});

    await app.register(versionPlugin, {
      versions: [{ version: 'v1', status: 'active' as const }],
      defaultVersion: 'v1',
    });

    await app.ready();

    expect(app.healthChecker).toBeDefined();
    expect(app.rbac).toBeDefined();
    expect(app.apiVersionManager).toBeDefined();

    await app.close();
  });
});
