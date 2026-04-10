// SaaS 카탈로그 승인 워크플로 테스트
// Design Ref: SVC-SAASCAT-R3 DESIGN -- 상태 전이 다이어그램
// Plan SC: FR-SCAT.4
// CSAP: D-06 감사 로그

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerRoutes } from '../../src/routes.js';
import { clearStore } from '../../src/lib/store.js';
import { clearAuditLog, getAuditLog } from '../../src/lib/audit.js';

const TENANT = 'tenant-wf';
const HEADERS = { 'x-tenant-id': TENANT, 'content-type': 'application/json' };

const VALID_ITEM = {
  name: '워크플로 테스트 SaaS',
  description: '승인 워크플로 검증용',
  category: 'BUSINESS',
  provider: '테스트(주)',
  version: '1.0.0',
};

describe('SaaS 카탈로그 승인 워크플로 (FR-SCAT.4)', () => {
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

  async function createItem(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: HEADERS,
      payload: VALID_ITEM,
    });
    return res.json().data.id;
  }

  // --- DRAFT -> PENDING ---

  it('POST /:id/submit: DRAFT -> PENDING 전환 성공', async () => {
    const id = await createItem();
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('PENDING');
  });

  it('POST /:id/submit: PENDING 상태에서 재제출 시 409', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(409);
  });

  // --- PENDING -> APPROVED ---

  it('POST /:id/approve: PENDING -> APPROVED 전환 성공', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/approve`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('APPROVED');
  });

  it('POST /:id/approve: DRAFT 상태에서 승인 시 409', async () => {
    const id = await createItem();
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/approve`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(409);
  });

  // --- PENDING -> REJECTED ---

  it('POST /:id/reject: PENDING -> REJECTED 전환 성공 (사유 포함)', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/reject`,
      headers: HEADERS,
      payload: { reason: 'CSAP 인증 미비' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('REJECTED');
    expect(res.json().data.rejectionReason).toBe('CSAP 인증 미비');
  });

  it('POST /:id/reject: 사유 미입력 시 400', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/reject`,
      headers: HEADERS,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  // --- APPROVED -> DEPRECATED ---

  it('POST /:id/deprecate: APPROVED -> DEPRECATED 전환 성공', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/approve`,
      headers: { 'x-tenant-id': TENANT },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/deprecate`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('DEPRECATED');
  });

  it('POST /:id/deprecate: DRAFT 상태에서 폐기 시 409', async () => {
    const id = await createItem();
    const res = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/deprecate`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(409);
  });

  // --- REJECTED -> DRAFT (수정으로 복귀) ---

  it('REJECTED 상태에서 수정하면 유지됨 (재작성 가능)', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/reject`,
      headers: HEADERS,
      payload: { reason: '수정 필요' },
    });

    // REJECTED 상태에서 수정 가능
    const res = await app.inject({
      method: 'PUT',
      url: `/saas-catalog/${id}`,
      headers: HEADERS,
      payload: { name: '수정된 SaaS' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('수정된 SaaS');
  });

  // --- APPROVED 상태에서 수정 불가 ---

  it('APPROVED 상태에서 수정 시 409', async () => {
    const id = await createItem();
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/submit`,
      headers: { 'x-tenant-id': TENANT },
    });
    await app.inject({
      method: 'POST',
      url: `/saas-catalog/${id}/approve`,
      headers: { 'x-tenant-id': TENANT },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/saas-catalog/${id}`,
      headers: HEADERS,
      payload: { name: '수정 불가' },
    });
    expect(res.statusCode).toBe(409);
  });

  // --- 감사 로그 (CSAP D-06) ---

  it('전체 워크플로 실행 시 감사 로그 4건 생성', async () => {
    const id = await createItem();
    await app.inject({ method: 'POST', url: `/saas-catalog/${id}/submit`, headers: { 'x-tenant-id': TENANT } });
    await app.inject({ method: 'POST', url: `/saas-catalog/${id}/approve`, headers: { 'x-tenant-id': TENANT } });
    await app.inject({ method: 'POST', url: `/saas-catalog/${id}/deprecate`, headers: { 'x-tenant-id': TENANT } });

    const logs = getAuditLog(TENANT);
    // CREATE + SUBMIT + APPROVE + DEPRECATE = 4
    expect(logs.length).toBe(4);
    expect(logs.map((l) => l.action)).toEqual([
      'CATALOG_CREATE',
      'CATALOG_SUBMIT',
      'CATALOG_APPROVE',
      'CATALOG_DEPRECATE',
    ]);
  });

  it('미존재 항목에 대한 워크플로 요청 시 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog/nonexistent/submit',
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(404);
  });
});
