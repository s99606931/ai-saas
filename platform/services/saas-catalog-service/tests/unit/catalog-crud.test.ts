// SaaS 카탈로그 CRUD 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN
// Plan SC: FR-SCAT.1, FR-SCAT.2, FR-SCAT.3, FR-SCAT.6
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../../src/routes.js';
import { clearStore } from '../../src/lib/store.js';
import { clearAuditLog } from '../../src/lib/audit.js';

const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';
const HEADERS = { 'x-tenant-id': TENANT_A, 'content-type': 'application/json' };

const VALID_ITEM = {
  name: '공문서 관리 시스템',
  description: '공공기관 전자문서 관리 SaaS',
  category: 'DOCUMENT',
  provider: '한국문서관리(주)',
  version: '2.1.0',
  csapGrade: 'STANDARD',
  tags: ['문서', '전자결재'],
};

describe('SaaS 카탈로그 CRUD (FR-SCAT.1)', () => {
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

  // --- 생성 ---

  it('POST /saas-catalog: 유효한 데이터로 항목 생성 성공', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe(VALID_ITEM.name);
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.tenantId).toBe(TENANT_A);
    expect(body.data.id).toBeDefined();
  });

  it('POST /saas-catalog: 이름 미입력 시 400 반환', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: { ...VALID_ITEM, name: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /saas-catalog: X-Tenant-Id 없으면 400 반환', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json' },
      payload: VALID_ITEM,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TENANT_REQUIRED');
  });

  it('POST /saas-catalog: 잘못된 카테고리 시 400 반환', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: { ...VALID_ITEM, category: 'INVALID' },
    });
    expect(res.statusCode).toBe(400);
  });

  // --- 목록 조회 ---

  it('GET /saas-catalog: 빈 목록 반환', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it('GET /saas-catalog: 생성된 항목 목록 반환', async () => {
    // 3개 생성
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/saas-catalog',
        headers: HEADERS,
        payload: { ...VALID_ITEM, name: `항목 ${i}` },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.json().data.total).toBe(3);
  });

  it('GET /saas-catalog: 테넌트 격리 확인 (CSAP D-08-05)', async () => {
    // 테넌트 A에 생성
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });

    // 테넌트 B로 조회 -> 빈 목록
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog',
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(res.json().data.total).toBe(0);
  });

  it('GET /saas-catalog: 카테고리 필터', async () => {
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: { ...VALID_ITEM, category: 'SECURITY' },
    });
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?category=SECURITY',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.json().data.total).toBe(1);
    expect(res.json().data.items[0].category).toBe('SECURITY');
  });

  it('GET /saas-catalog: 검색 필터', async () => {
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: { ...VALID_ITEM, name: '보안 관제 시스템' },
    });
    await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?search=%EB%B3%B4%EC%95%88',
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.json().data.total).toBe(1);
  });

  it('GET /saas-catalog: 페이지네이션', async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/saas-catalog',
        headers: HEADERS,
        payload: { ...VALID_ITEM, name: `항목 ${i}` },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog?page=1&limit=2',
      headers: { 'x-tenant-id': TENANT_A },
    });
    const body = res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.total).toBe(5);
    expect(body.data.totalPages).toBe(3);
  });

  // --- 상세 조회 ---

  it('GET /saas-catalog/:id: 존재하는 항목 조회 성공', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    const id = createRes.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/saas-catalog/${id}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('GET /saas-catalog/:id: 다른 테넌트 접근 시 404 (CSAP D-08-05)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    const id = createRes.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/saas-catalog/${id}`,
      headers: { 'x-tenant-id': TENANT_B },
    });
    expect(res.statusCode).toBe(404);
  });

  // --- 수정 ---

  it('PUT /saas-catalog/:id: DRAFT 상태에서 수정 성공', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    const id = createRes.json().data.id;

    const res = await app.inject({
      method: 'PUT',
      url: `/saas-catalog/${id}`,
      headers: HEADERS,
      payload: { name: '수정된 이름' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('수정된 이름');
  });

  // --- 삭제 ---

  it('DELETE /saas-catalog/:id: DRAFT 상태에서 삭제 성공', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    const id = createRes.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/saas-catalog/${id}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(res.statusCode).toBe(200);

    // 삭제 후 조회 시 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/saas-catalog/${id}`,
      headers: { 'x-tenant-id': TENANT_A },
    });
    expect(getRes.statusCode).toBe(404);
  });

  // --- 카테고리 ---

  it('GET /saas-catalog/categories: 카테고리 목록 반환', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/saas-catalog/categories',
    });
    expect(res.statusCode).toBe(200);
    const cats = res.json().data;
    expect(cats.length).toBe(8);
    expect(cats[0]).toHaveProperty('code');
    expect(cats[0]).toHaveProperty('name');
  });
});
