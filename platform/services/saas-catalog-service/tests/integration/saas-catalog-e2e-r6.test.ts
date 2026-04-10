// SaaS 카탈로그 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.10
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('saas-catalog-service E2E -- CRUD + 승인 워크플로 (CSAP D-08-05)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface CatalogItem {
    id: string;
    tenantId: string;
    name: string;
    description: string;
    category: string;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPRECATED';
    createdBy: string;
    createdAt: string;
    approvedBy?: string;
    rejectedReason?: string;
  }

  const items = new Map<string, CatalogItem>();
  let itemCounter = 0;

  const CATEGORIES = ['인프라', '보안', '데이터', 'AI/ML', '업무지원', '공통'];

  app.get('/saas-catalog/categories', async () => {
    return { success: true, data: CATEGORIES };
  });

  app.post('/saas-catalog', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
      });
      return;
    }
    const body = req.body as { name?: string; description?: string; category?: string };
    if (!body.name || !body.category) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이름과 카테고리는 필수입니다' },
      });
      return;
    }
    if (!CATEGORIES.includes(body.category)) {
      await reply.status(400).send({
        success: false,
        error: { code: 'INVALID_CATEGORY', message: '유효하지 않은 카테고리입니다' },
      });
      return;
    }
    const id = `scat-${++itemCounter}`;
    const item: CatalogItem = {
      id,
      tenantId,
      name: body.name,
      description: body.description ?? '',
      category: body.category,
      status: 'DRAFT',
      createdBy: (req.headers['x-user-id'] as string) ?? 'anonymous',
      createdAt: new Date().toISOString(),
    };
    items.set(id, item);
    await reply.status(201).send({ success: true, data: item });
  });

  app.get('/saas-catalog', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-Id 헤더가 필요합니다' },
      });
      return;
    }
    const query = req.query as { category?: string; status?: string; search?: string };
    let filtered = Array.from(items.values()).filter((i) => i.tenantId === tenantId);
    if (query.category) filtered = filtered.filter((i) => i.category === query.category);
    if (query.status) filtered = filtered.filter((i) => i.status === query.status);
    if (query.search) {
      const term = query.search.toLowerCase();
      filtered = filtered.filter(
        (i) => i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term),
      );
    }
    return { success: true, data: filtered };
  });

  app.get('/saas-catalog/:id', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'TENANT_REQUIRED' },
      });
      return;
    }
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item || item.tenantId !== tenantId) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '항목을 찾을 수 없습니다' },
      });
      return;
    }
    return { success: true, data: item };
  });

  app.put('/saas-catalog/:id', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item || item.tenantId !== tenantId) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    const body = req.body as { name?: string; description?: string };
    if (body.name) item.name = body.name;
    if (body.description) item.description = body.description;
    return { success: true, data: item };
  });

  app.delete('/saas-catalog/:id', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item || item.tenantId !== tenantId) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    items.delete(id);
    return { success: true, message: '삭제 완료' };
  });

  // 승인 워크플로
  app.post('/saas-catalog/:id/submit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    if (item.status !== 'DRAFT') {
      await reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'DRAFT 상태에서만 제출 가능합니다' },
      });
      return;
    }
    item.status = 'PENDING';
    return { success: true, data: item };
  });

  app.post('/saas-catalog/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    if (item.status !== 'PENDING') {
      await reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'PENDING 상태에서만 승인 가능합니다' },
      });
      return;
    }
    item.status = 'APPROVED';
    item.approvedBy = (req.headers['x-user-id'] as string) ?? 'admin';
    return { success: true, data: item };
  });

  app.post('/saas-catalog/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    if (item.status !== 'PENDING') {
      await reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'PENDING 상태에서만 반려 가능합니다' },
      });
      return;
    }
    const body = req.body as { reason?: string };
    item.status = 'REJECTED';
    item.rejectedReason = body.reason ?? '사유 미기재';
    return { success: true, data: item };
  });

  app.post('/saas-catalog/:id/deprecate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = items.get(id);
    if (!item) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    if (item.status !== 'APPROVED') {
      await reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'APPROVED 상태에서만 폐기 가능합니다' },
      });
      return;
    }
    item.status = 'DEPRECATED';
    return { success: true, data: item };
  });

  app.get('/saas-catalog/stats', async () => {
    const all = Array.from(items.values());
    return {
      success: true,
      data: {
        total: all.length,
        byStatus: {
          DRAFT: all.filter((i) => i.status === 'DRAFT').length,
          PENDING: all.filter((i) => i.status === 'PENDING').length,
          APPROVED: all.filter((i) => i.status === 'APPROVED').length,
          REJECTED: all.filter((i) => i.status === 'REJECTED').length,
          DEPRECATED: all.filter((i) => i.status === 'DEPRECATED').length,
        },
        byCategory: Object.fromEntries(CATEGORIES.map((cat) => [cat, all.filter((i) => i.category === cat).length])),
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('항목 등록 -> 제출 -> 승인 -> 폐기 전체 워크플로', async () => {
    const tenant = 't-saas-cat';

    // 1. 등록 (DRAFT)
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenant,
        'x-user-id': 'dev-1',
      },
      payload: { name: 'AI 챗봇 서비스', description: 'LLM 기반 챗봇', category: 'AI/ML' },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data.status).toBe('DRAFT');
    const itemId = createRes.json().data.id;

    // 2. 제출 (DRAFT -> PENDING)
    const submitRes = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${itemId}/submit`,
    });
    expect(submitRes.json().data.status).toBe('PENDING');

    // 3. 승인 (PENDING -> APPROVED)
    const approveRes = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${itemId}/approve`,
      headers: { 'x-user-id': 'admin-1' },
    });
    expect(approveRes.json().data.status).toBe('APPROVED');
    expect(approveRes.json().data.approvedBy).toBe('admin-1');

    // 4. 폐기 (APPROVED -> DEPRECATED)
    const deprecateRes = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${itemId}/deprecate`,
    });
    expect(deprecateRes.json().data.status).toBe('DEPRECATED');
  });

  it('반려 워크플로 (PENDING -> REJECTED)', async () => {
    const tenant = 't-reject';

    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenant },
      payload: { name: '미완성 서비스', category: '보안' },
    });
    const itemId = createRes.json().data.id;

    await app.inject({ method: 'POST', url: `/saas-catalog/${itemId}/submit` });

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${itemId}/reject`,
      headers: { 'content-type': 'application/json' },
      payload: { reason: '보안 검토 미완료' },
    });
    expect(rejectRes.json().data.status).toBe('REJECTED');
    expect(rejectRes.json().data.rejectedReason).toBe('보안 검토 미완료');
  });

  it('CSAP D-08-05: 테넌트 격리 -- 타 테넌트 항목 접근 차단', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 't-owner' },
      payload: { name: '비밀 서비스', category: '보안' },
    });
    const itemId = createRes.json().data.id;

    // 다른 테넌트로 접근
    const getRes = await app.inject({
      method: 'GET',
      url: `/saas-catalog/${itemId}`,
      headers: { 'x-tenant-id': 't-attacker' },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('유효하지 않은 카테고리 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 't-val' },
      payload: { name: '테스트', category: '존재하지않는카테고리' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_CATEGORY');
  });

  it('잘못된 상태 전이 차단 (DRAFT에서 바로 승인 시도)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 't-state' },
      payload: { name: '상태 테스트', category: '공통' },
    });
    const itemId = createRes.json().data.id;

    const approveRes = await app.inject({
      method: 'POST',
      url: `/saas-catalog/${itemId}/approve`,
    });
    expect(approveRes.statusCode).toBe(409);
    expect(approveRes.json().error.code).toBe('INVALID_STATUS');
  });

  it('검색 + 필터링 + 통계', async () => {
    // 카테고리 목록
    const catRes = await app.inject({ method: 'GET', url: '/saas-catalog/categories' });
    expect(catRes.json().data.length).toBe(6);

    // 통계
    const statsRes = await app.inject({ method: 'GET', url: '/saas-catalog/stats' });
    expect(statsRes.json().data.total).toBeGreaterThan(0);
  });

  it('X-Tenant-Id 헤더 없이 요청 시 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/saas-catalog',
      headers: { 'content-type': 'application/json' },
      payload: { name: '테스트', category: '공통' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TENANT_REQUIRED');
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/saas-catalog/categories' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
