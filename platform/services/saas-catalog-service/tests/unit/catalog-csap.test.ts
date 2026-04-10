// SaaS 카탈로그 CSAP 보안 준수 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.6
// CSAP: D-08-05, D-06, D-12

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../../src/routes.js';
import { clearStore } from '../../src/lib/store.js';
import { clearAuditLog, getAuditLog } from '../../src/lib/audit.js';
import { createCatalogSchema, rejectSchema } from '../../src/schemas/catalog.schema.js';

const TENANT = 'tenant-csap';
const HEADERS = { 'x-tenant-id': TENANT, 'content-type': 'application/json' };

describe('CSAP D-08-05: 테넌트 격리', () => {
  const app = Fastify();
  app.register(async (instance) => {
    await registerRoutes(instance);
  });

  beforeEach(() => {
    clearStore();
    clearAuditLog();
  });

  afterAll(async () => {
    await app.close();
  });

  it('모든 API에서 X-Tenant-Id 누락 시 400 반환', async () => {
    const endpoints = [
      { method: 'POST' as const, url: '/saas-catalog' },
      { method: 'GET' as const, url: '/saas-catalog' },
      { method: 'GET' as const, url: '/saas-catalog/some-id' },
      { method: 'PUT' as const, url: '/saas-catalog/some-id' },
      { method: 'DELETE' as const, url: '/saas-catalog/some-id' },
      { method: 'GET' as const, url: '/saas-catalog/stats' },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { 'content-type': 'application/json' },
        payload: ep.method === 'POST' || ep.method === 'PUT' ? {} : undefined,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('TENANT_REQUIRED');
    }
  });

  it('다른 테넌트의 데이터에 접근 불가 (격리)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: {
        name: '테넌트 A 전용',
        description: '격리 테스트',
        category: 'SECURITY',
        provider: '테스트(주)',
        version: '1.0.0',
      },
    });
    const id = createRes.json().data.id;

    // 다른 테넌트로 접근
    const operations = [
      app.inject({ method: 'GET', url: `/saas-catalog/${id}`, headers: { 'x-tenant-id': 'tenant-other' } }),
      app.inject({
        method: 'PUT',
        url: `/saas-catalog/${id}`,
        headers: { 'x-tenant-id': 'tenant-other', 'content-type': 'application/json' },
        payload: { name: 'hack' },
      }),
      app.inject({ method: 'DELETE', url: `/saas-catalog/${id}`, headers: { 'x-tenant-id': 'tenant-other' } }),
      app.inject({ method: 'POST', url: `/saas-catalog/${id}/submit`, headers: { 'x-tenant-id': 'tenant-other' } }),
    ];

    const results = await Promise.all(operations);
    for (const res of results) {
      expect(res.statusCode).toBe(404);
    }
  });
});

describe('CSAP D-06: 감사 로그', () => {
  const app = Fastify();
  app.register(async (instance) => {
    await registerRoutes(instance);
  });

  beforeEach(() => {
    clearStore();
    clearAuditLog();
  });

  afterAll(async () => {
    await app.close();
  });

  it('항목 생성 시 감사 로그 기록', async () => {
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: {
        name: '감사 테스트',
        description: '로그 기록 확인',
        category: 'BUSINESS',
        provider: '테스트',
        version: '1.0',
      },
    });

    const logs = getAuditLog(TENANT);
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('CATALOG_CREATE');
    expect(logs[0].tenantId).toBe(TENANT);
    expect(logs[0].timestamp).toBeDefined();
  });

  it('항목 수정 시 감사 로그 기록', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: {
        name: '수정 테스트',
        description: '로그 기록 확인',
        category: 'BUSINESS',
        provider: '테스트',
        version: '1.0',
      },
    });
    const id = createRes.json().data.id;

    await app.inject({
      method: 'PUT',
      url: `/saas-catalog/${id}`,
      headers: HEADERS,
      payload: { name: '수정됨' },
    });

    const logs = getAuditLog(TENANT);
    expect(logs.length).toBe(2);
    expect(logs[1].action).toBe('CATALOG_UPDATE');
  });

  it('항목 삭제 시 감사 로그 기록', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: {
        name: '삭제 테스트',
        description: '로그 기록 확인',
        category: 'BUSINESS',
        provider: '테스트',
        version: '1.0',
      },
    });
    const id = createRes.json().data.id;

    await app.inject({
      method: 'DELETE',
      url: `/saas-catalog/${id}`,
      headers: { 'x-tenant-id': TENANT },
    });

    const logs = getAuditLog(TENANT);
    expect(logs.length).toBe(2);
    expect(logs[1].action).toBe('CATALOG_DELETE');
  });
});

describe('CSAP D-12: Zod 입력 검증 스키마', () => {
  it('createCatalogSchema: 유효한 데이터 통과', () => {
    const result = createCatalogSchema.safeParse({
      name: '테스트',
      description: '설명',
      category: 'SECURITY',
      provider: '제공자',
      version: '1.0',
    });
    expect(result.success).toBe(true);
  });

  it('createCatalogSchema: 이름 200자 초과 시 실패', () => {
    const result = createCatalogSchema.safeParse({
      name: 'x'.repeat(201),
      description: '설명',
      category: 'SECURITY',
      provider: '제공자',
      version: '1.0',
    });
    expect(result.success).toBe(false);
  });

  it('createCatalogSchema: 잘못된 URL 시 실패', () => {
    const result = createCatalogSchema.safeParse({
      name: '테스트',
      description: '설명',
      category: 'SECURITY',
      provider: '제공자',
      version: '1.0',
      documentationUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('createCatalogSchema: 태그 20개 초과 시 실패', () => {
    const result = createCatalogSchema.safeParse({
      name: '테스트',
      description: '설명',
      category: 'SECURITY',
      provider: '제공자',
      version: '1.0',
      tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejectSchema: 빈 사유 시 실패', () => {
    const result = rejectSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejectSchema: 유효한 사유 통과', () => {
    const result = rejectSchema.safeParse({ reason: 'CSAP 인증 미비' });
    expect(result.success).toBe(true);
  });
});
