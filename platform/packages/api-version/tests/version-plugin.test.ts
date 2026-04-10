// @public-saas/api-version Fastify 플러그인 통합 테스트
// Design Ref: SVC-APIVER-R9 Plan
// Plan SC: FR-APIVER.2, FR-APIVER.3

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { versionPlugin } from '../src/version-plugin.js';

describe('API 버전 플러그인 -- E2E', () => {
  const app = Fastify();

  app.register(versionPlugin, {
    versions: [
      { version: 'v1', status: 'active' },
      { version: 'v2', status: 'active' },
      {
        version: 'v0',
        status: 'deprecated',
        sunsetDate: '2026-06-30T00:00:00Z',
        replacedBy: 'v1',
      },
      { version: 'v0beta', status: 'sunset' },
    ],
    defaultVersion: 'v1',
  });

  // v1 라우트
  app.get('/v1/tenants', async (req) => {
    return {
      success: true,
      version: req.apiVersion,
      data: [{ id: 't-1', name: '테넌트1' }],
    };
  });

  // v2 라우트 (새 형식)
  app.get('/v2/tenants', async (req) => {
    return {
      success: true,
      version: req.apiVersion,
      data: { items: [{ id: 't-1', name: '테넌트1', tier: 'enterprise' }], total: 1 },
    };
  });

  // v0 라우트 (deprecated)
  app.get('/v0/tenants', async (req) => {
    return {
      success: true,
      version: req.apiVersion,
      data: ['tenant-1'],
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('v1 라우트 접근 -- 정상 응답 (경고 헤더 없음)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/tenants' });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe('v1');
    expect(res.headers['deprecation']).toBeUndefined();
  });

  it('v2 라우트 접근 -- 새 응답 형식', async () => {
    const res = await app.inject({ method: 'GET', url: '/v2/tenants' });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe('v2');
    expect(res.json().data.items).toBeDefined();
    expect(res.json().data.total).toBe(1);
  });

  it('v0 라우트 접근 -- Deprecation 경고 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/v0/tenants' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['deprecation']).toBe('true');
    expect(res.headers['sunset']).toBeDefined();
    expect(res.headers['x-api-replace-with']).toBe('v1');
  });

  it('sunset 버전 접근 -- 410 Gone', async () => {
    const res = await app.inject({ method: 'GET', url: '/v0beta/tenants' });
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('API_VERSION_SUNSET');
  });

  it('/api/versions -- 버전 정보 엔드포인트', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/versions' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.default).toBe('v1');
    expect(res.json().data.versions.length).toBe(4);
  });

  it('요청 객체에 apiVersion이 설정됨', async () => {
    const res = await app.inject({ method: 'GET', url: '/v2/tenants' });
    expect(res.json().version).toBe('v2');
  });
});
