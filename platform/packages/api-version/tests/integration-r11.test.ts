// Round 11 통합 테스트: versionPlugin 서비스 통합 검증
// Design Ref: SVC-INTEGRATE-R11 Plan
// Plan SC: FR-INT.4, FR-INT.6
// CSAP: D-12 API 관리

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { versionPlugin } from '../src/index.js';

// ══════════════════════════════════════════════════════════════
// T-INT.4: versionPlugin 서비스 통합 테스트
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

  it('apiVersionManager decorator가 등록된다', () => {
    expect(app.apiVersionManager).toBeDefined();
    expect(typeof app.apiVersionManager.extractVersion).toBe('function');
    expect(typeof app.apiVersionManager.isValidVersion).toBe('function');
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
    expect(body.data.versions.map((v: { version: string }) => v.version)).toContain('v0');
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

  it('deprecated 버전 요청에 Deprecation 헤더가 포함된다', async () => {
    // v0 요청 -- deprecated 헤더 확인
    // /api/versions 호출 시 URL이 /api로 시작하므로 v0이 아님
    // v0 경로에 대한 직접 라우트 등록
    const testApp = Fastify({ logger: false });
    await testApp.register(versionPlugin, {
      versions: [
        { version: 'v0', status: 'deprecated', sunsetDate: '2027-01-01', replacedBy: 'v1' },
        { version: 'v1', status: 'active' },
      ],
      defaultVersion: 'v1',
    });
    testApp.get('/v0/test', async () => ({ ok: true }));
    await testApp.ready();

    const res = await testApp.inject({ method: 'GET', url: '/v0/test' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['x-api-deprecated']).toBeTruthy();
    expect(res.headers['sunset']).toBeTruthy();
    expect(res.headers['x-api-replace-with']).toBe('v1');

    await testApp.close();
  });

  it('sunset 버전 요청이 410으로 차단된다', async () => {
    const testApp = Fastify({ logger: false });
    await testApp.register(versionPlugin, {
      versions: [
        { version: 'v0', status: 'sunset' },
        { version: 'v1', status: 'active' },
      ],
      defaultVersion: 'v1',
    });
    testApp.get('/v0/test', async () => ({ ok: true }));
    await testApp.ready();

    const res = await testApp.inject({ method: 'GET', url: '/v0/test' });
    expect(res.statusCode).toBe(410);
    const body = res.json();
    expect(body.error.code).toBe('API_VERSION_SUNSET');

    await testApp.close();
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

  it('활성 버전 목록이 올바르다', () => {
    const active = app.apiVersionManager.getActiveVersions();
    expect(active).toHaveLength(2);
    expect(active.map(v => v.version)).toContain('v1');
    expect(active.map(v => v.version)).toContain('v2');
  });
});
