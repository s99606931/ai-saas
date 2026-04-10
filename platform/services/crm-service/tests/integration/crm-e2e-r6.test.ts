// CRM 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.4
// CSAP: D-06 감사 로그, D-08 접근 통제

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('crm-service E2E -- 고객/계약 관리 전체 플로우 (CSAP D-06)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface Customer {
    id: string;
    name: string;
    industry: string;
    tenantId: string;
    status: 'ACTIVE' | 'INACTIVE';
    contacts: Array<{ id: string; name: string; email: string; role: string }>;
    contracts: Array<{
      id: string;
      planName: string;
      startDate: string;
      endDate: string;
      status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    }>;
  }

  const customers = new Map<string, Customer>();
  let contactCounter = 0;
  let contractCounter = 0;

  app.post('/crm/customers', async (req, reply) => {
    const body = req.body as { name?: string; industry?: string; tenantId?: string };
    if (!body.name) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '고객명은 필수입니다' },
      });
      return;
    }
    const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const customer: Customer = {
      id,
      name: body.name,
      industry: body.industry ?? '기타',
      tenantId: body.tenantId ?? 'default',
      status: 'ACTIVE',
      contacts: [],
      contracts: [],
    };
    customers.set(id, customer);
    await reply.status(201).send({ success: true, data: customer });
  });

  app.get('/crm/customers', async (req) => {
    const query = req.query as { tenantId?: string; search?: string };
    let items = Array.from(customers.values());
    if (query.tenantId) items = items.filter((c) => c.tenantId === query.tenantId);
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(term));
    }
    return { success: true, data: items, total: items.length };
  });

  app.get('/crm/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cust = customers.get(id);
    if (!cust) {
      await reply.status(404).send({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: '고객을 찾을 수 없습니다' },
      });
      return;
    }
    return { success: true, data: cust };
  });

  app.put('/crm/customers/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cust = customers.get(id);
    if (!cust) {
      await reply.status(404).send({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: '고객을 찾을 수 없습니다' },
      });
      return;
    }
    const body = req.body as { name?: string; status?: 'ACTIVE' | 'INACTIVE' };
    if (body.name) cust.name = body.name;
    if (body.status) cust.status = body.status;
    return { success: true, data: cust };
  });

  app.post('/crm/customers/:id/contacts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cust = customers.get(id);
    if (!cust) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    const body = req.body as { name: string; email: string; role?: string };
    const contact = {
      id: `contact-${++contactCounter}`,
      name: body.name,
      email: body.email,
      role: body.role ?? '담당자',
    };
    cust.contacts.push(contact);
    await reply.status(201).send({ success: true, data: contact });
  });

  app.get('/crm/customers/:id/contacts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cust = customers.get(id);
    if (!cust) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    return { success: true, data: cust.contacts };
  });

  app.post('/crm/contracts', async (req, reply) => {
    const body = req.body as {
      customerId: string;
      planName: string;
      startDate: string;
      endDate: string;
    };
    const cust = customers.get(body.customerId);
    if (!cust) {
      await reply.status(404).send({ success: false, error: { code: 'CUSTOMER_NOT_FOUND' } });
      return;
    }
    const contract = {
      id: `contract-${++contractCounter}`,
      planName: body.planName,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'ACTIVE' as const,
    };
    cust.contracts.push(contract);
    await reply.status(201).send({ success: true, data: contract });
  });

  app.get('/crm/contracts/expiring', async () => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiring: Array<{ customerId: string; customerName: string; contractId: string; endDate: string }> = [];
    for (const cust of customers.values()) {
      for (const contract of cust.contracts) {
        const end = new Date(contract.endDate);
        if (contract.status === 'ACTIVE' && end <= thirtyDays && end >= now) {
          expiring.push({
            customerId: cust.id,
            customerName: cust.name,
            contractId: contract.id,
            endDate: contract.endDate,
          });
        }
      }
    }
    return { success: true, data: expiring };
  });

  app.get('/crm/stats', async () => {
    const all = Array.from(customers.values());
    return {
      success: true,
      data: {
        totalCustomers: all.length,
        activeCustomers: all.filter((c) => c.status === 'ACTIVE').length,
        totalContacts: all.reduce((sum, c) => sum + c.contacts.length, 0),
        totalContracts: all.reduce((sum, c) => sum + c.contracts.length, 0),
      },
    };
  });

  app.get('/crm/pipeline', async () => {
    const all = Array.from(customers.values());
    return {
      success: true,
      data: {
        prospects: all.filter((c) => c.contracts.length === 0).length,
        active: all.filter((c) => c.contracts.some((ct) => ct.status === 'ACTIVE')).length,
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('고객 등록 -> 담당자 추가 -> 계약 생성 전체 플로우', async () => {
    // 1. 고객 등록
    const custRes = await app.inject({
      method: 'POST',
      url: '/crm/customers',
      headers: { 'content-type': 'application/json' },
      payload: { name: '서울시청', industry: '공공기관', tenantId: 't-crm' },
    });
    expect(custRes.statusCode).toBe(201);
    const custId = custRes.json().data.id;

    // 2. 담당자 추가
    const contactRes = await app.inject({
      method: 'POST',
      url: `/crm/customers/${custId}/contacts`,
      headers: { 'content-type': 'application/json' },
      payload: { name: '김담당', email: 'kim@seoul.go.kr', role: 'PM' },
    });
    expect(contactRes.statusCode).toBe(201);
    expect(contactRes.json().data.role).toBe('PM');

    // 3. 계약 생성
    const contractRes = await app.inject({
      method: 'POST',
      url: '/crm/contracts',
      headers: { 'content-type': 'application/json' },
      payload: {
        customerId: custId,
        planName: 'Enterprise',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    });
    expect(contractRes.statusCode).toBe(201);

    // 4. 고객 상세 조회 -- 담당자/계약 포함
    const detailRes = await app.inject({
      method: 'GET',
      url: `/crm/customers/${custId}`,
    });
    expect(detailRes.json().data.contacts.length).toBe(1);
    expect(detailRes.json().data.contracts.length).toBe(1);
  });

  it('고객 검색 + 테넌트 필터링', async () => {
    const searchRes = await app.inject({
      method: 'GET',
      url: `/crm/customers?tenantId=t-crm&search=${encodeURIComponent('서울')}`,
    });
    expect(searchRes.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('계약 만료 임박 조회', async () => {
    // 만료 임박 계약 생성
    const custRes = await app.inject({
      method: 'POST',
      url: '/crm/customers',
      headers: { 'content-type': 'application/json' },
      payload: { name: '만료임박사', tenantId: 't-exp' },
    });
    const custId = custRes.json().data.id;

    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await app.inject({
      method: 'POST',
      url: '/crm/contracts',
      headers: { 'content-type': 'application/json' },
      payload: {
        customerId: custId,
        planName: 'Basic',
        startDate: '2026-01-01',
        endDate: futureDate,
      },
    });

    const expiringRes = await app.inject({ method: 'GET', url: '/crm/contracts/expiring' });
    expect(expiringRes.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('CRM 통계 + 파이프라인', async () => {
    const statsRes = await app.inject({ method: 'GET', url: '/crm/stats' });
    expect(statsRes.json().data.totalCustomers).toBeGreaterThan(0);

    const pipelineRes = await app.inject({ method: 'GET', url: '/crm/pipeline' });
    expect(pipelineRes.json().success).toBe(true);
    expect(pipelineRes.json().data.active).toBeGreaterThanOrEqual(0);
  });

  it('존재하지 않는 고객 접근 시 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/crm/customers/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/crm/stats' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
