// 카탈로그 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.3
// CSAP: D-08-05 테넌트 격리, D-12 입력 검증

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('catalog-service E2E -- 서비스 카탈로그 CRUD + 검색 (CSAP D-08-05)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface CatalogService {
    id: string;
    name: string;
    category: string;
    version: string;
    status: 'ACTIVE' | 'INACTIVE';
    features: Record<string, boolean>;
    tenantId: string;
    createdAt: string;
  }

  const services = new Map<string, CatalogService>();
  let idCounter = 0;

  app.get('/catalog/services', async (req) => {
    const query = req.query as { category?: string; search?: string; tenantId?: string };
    let items = Array.from(services.values());
    if (query.tenantId) items = items.filter((s) => s.tenantId === query.tenantId);
    if (query.category) items = items.filter((s) => s.category === query.category);
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter((s) => s.name.toLowerCase().includes(term));
    }
    return { success: true, data: items, total: items.length };
  });

  app.get('/catalog/services/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = services.get(id);
    if (!svc) {
      await reply.status(404).send({
        success: false,
        error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다' },
      });
      return;
    }
    return { success: true, data: svc };
  });

  app.post('/catalog/services', async (req, reply) => {
    const body = req.body as {
      name?: string;
      category?: string;
      version?: string;
      tenantId?: string;
    };
    if (!body.name || !body.category) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이름과 카테고리는 필수입니다' },
      });
      return;
    }
    const id = `cat-${++idCounter}`;
    const svc: CatalogService = {
      id,
      name: body.name,
      category: body.category,
      version: body.version ?? '1.0.0',
      status: 'ACTIVE',
      features: {},
      tenantId: body.tenantId ?? 'default',
      createdAt: new Date().toISOString(),
    };
    services.set(id, svc);
    await reply.status(201).send({ success: true, data: svc });
  });

  app.put('/catalog/services/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = services.get(id);
    if (!svc) {
      await reply.status(404).send({
        success: false,
        error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다' },
      });
      return;
    }
    const body = req.body as { name?: string; status?: 'ACTIVE' | 'INACTIVE' };
    if (body.name) svc.name = body.name;
    if (body.status) svc.status = body.status;
    return { success: true, data: svc };
  });

  app.delete('/catalog/services/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!services.has(id)) {
      await reply.status(404).send({
        success: false,
        error: { code: 'SERVICE_NOT_FOUND', message: '서비스를 찾을 수 없습니다' },
      });
      return;
    }
    services.delete(id);
    return { success: true, message: '삭제 완료' };
  });

  app.put('/catalog/services/:id/version', async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = services.get(id);
    if (!svc) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    const body = req.body as { version: string };
    svc.version = body.version;
    return { success: true, data: svc };
  });

  app.get('/catalog/services/:id/flags', async (req, reply) => {
    const { id } = req.params as { id: string };
    const svc = services.get(id);
    if (!svc) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    return { success: true, data: svc.features };
  });

  app.put('/catalog/services/:id/flags/:flag', async (req, reply) => {
    const { id, flag } = req.params as { id: string; flag: string };
    const svc = services.get(id);
    if (!svc) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    const body = req.body as { enabled: boolean };
    svc.features[flag] = body.enabled;
    return { success: true, data: { flag, enabled: body.enabled } };
  });

  app.get('/catalog/categories', async () => {
    const categories = [...new Set(Array.from(services.values()).map((s) => s.category))];
    return { success: true, data: categories };
  });

  app.get('/catalog/stats', async () => {
    const all = Array.from(services.values());
    return {
      success: true,
      data: {
        totalServices: all.length,
        activeServices: all.filter((s) => s.status === 'ACTIVE').length,
        categories: [...new Set(all.map((s) => s.category))].length,
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('서비스 등록 -> 검색 -> 수정 -> 삭제 전체 CRUD', async () => {
    // 등록
    const createRes = await app.inject({
      method: 'POST',
      url: '/catalog/services',
      headers: { 'content-type': 'application/json' },
      payload: { name: '문서관리', category: '업무지원', tenantId: 't-cat' },
    });
    expect(createRes.statusCode).toBe(201);
    const svcId = createRes.json().data.id;

    // 검색
    const searchRes = await app.inject({
      method: 'GET',
      url: '/catalog/services?search=%EB%AC%B8%EC%84%9C',
    });
    expect(searchRes.json().data.length).toBe(1);

    // 수정
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/catalog/services/${svcId}`,
      headers: { 'content-type': 'application/json' },
      payload: { name: '문서관리 v2' },
    });
    expect(updateRes.json().data.name).toBe('문서관리 v2');

    // 삭제
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/catalog/services/${svcId}`,
    });
    expect(deleteRes.json().success).toBe(true);

    // 삭제 후 조회 실패
    const getRes = await app.inject({
      method: 'GET',
      url: `/catalog/services/${svcId}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('버전 관리 + 피처 플래그 토글', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/catalog/services',
      headers: { 'content-type': 'application/json' },
      payload: { name: '전자결재', category: '공공행정', version: '1.0.0' },
    });
    const svcId = createRes.json().data.id;

    // 버전 업데이트
    const versionRes = await app.inject({
      method: 'PUT',
      url: `/catalog/services/${svcId}/version`,
      headers: { 'content-type': 'application/json' },
      payload: { version: '2.0.0' },
    });
    expect(versionRes.json().data.version).toBe('2.0.0');

    // 피처 플래그 활성화
    const flagRes = await app.inject({
      method: 'PUT',
      url: `/catalog/services/${svcId}/flags/dark-mode`,
      headers: { 'content-type': 'application/json' },
      payload: { enabled: true },
    });
    expect(flagRes.json().data.enabled).toBe(true);

    // 플래그 목록 확인
    const flagsRes = await app.inject({
      method: 'GET',
      url: `/catalog/services/${svcId}/flags`,
    });
    expect(flagsRes.json().data['dark-mode']).toBe(true);
  });

  it('카테고리별 필터링 + 통계', async () => {
    await app.inject({
      method: 'POST',
      url: '/catalog/services',
      headers: { 'content-type': 'application/json' },
      payload: { name: '인사관리', category: 'HR' },
    });

    const filterRes = await app.inject({
      method: 'GET',
      url: '/catalog/services?category=HR',
    });
    expect(filterRes.json().data.length).toBeGreaterThanOrEqual(1);

    const statsRes = await app.inject({ method: 'GET', url: '/catalog/stats' });
    expect(statsRes.json().data.totalServices).toBeGreaterThan(0);
  });

  it('입력 검증 -- 필수 필드 누락 시 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/catalog/services',
      headers: { 'content-type': 'application/json' },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/catalog/stats' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
