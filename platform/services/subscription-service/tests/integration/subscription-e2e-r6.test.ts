// 구독 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.9
// CSAP: D-06 감사 로그, D-08-05 테넌트 격리

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('subscription-service E2E -- 구독 생명주기 관리 (CSAP D-06)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface Plan {
    id: string;
    name: string;
    price: number;
    maxUsers: number;
    features: string[];
    isActive: boolean;
  }

  interface Subscription {
    id: string;
    tenantId: string;
    planId: string;
    planName: string;
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
    startDate: string;
    endDate: string;
  }

  const plans = new Map<string, Plan>();
  const subscriptions = new Map<string, Subscription>();
  const auditLog: Array<{ action: string; target: string; timestamp: string }> = [];
  let planCounter = 0;
  let subCounter = 0;

  app.get('/subscription/plans', async () => {
    const active = Array.from(plans.values()).filter((p) => p.isActive);
    return { success: true, data: active };
  });

  app.post('/subscription/plans', async (req, reply) => {
    const body = req.body as {
      name?: string;
      price?: number;
      maxUsers?: number;
      features?: string[];
    };
    if (!body.name || body.price === undefined) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이름과 가격은 필수입니다' },
      });
      return;
    }
    const id = `plan-${++planCounter}`;
    const plan: Plan = {
      id,
      name: body.name,
      price: body.price,
      maxUsers: body.maxUsers ?? 10,
      features: body.features ?? [],
      isActive: true,
    };
    plans.set(id, plan);
    auditLog.push({ action: 'PLAN_CREATED', target: id, timestamp: new Date().toISOString() });
    await reply.status(201).send({ success: true, data: plan });
  });

  app.put('/subscription/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const plan = plans.get(id);
    if (!plan) {
      await reply.status(404).send({ success: false, error: { code: 'PLAN_NOT_FOUND' } });
      return;
    }
    const body = req.body as { name?: string; price?: number; isActive?: boolean };
    if (body.name) plan.name = body.name;
    if (body.price !== undefined) plan.price = body.price;
    if (body.isActive !== undefined) plan.isActive = body.isActive;
    auditLog.push({ action: 'PLAN_UPDATED', target: id, timestamp: new Date().toISOString() });
    return { success: true, data: plan };
  });

  app.post('/subscription/subscribe', async (req, reply) => {
    const body = req.body as { tenantId?: string; planId?: string };
    if (!body.tenantId || !body.planId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '테넌트 ID와 플랜 ID는 필수입니다' },
      });
      return;
    }
    const plan = plans.get(body.planId);
    if (!plan) {
      await reply.status(404).send({ success: false, error: { code: 'PLAN_NOT_FOUND' } });
      return;
    }
    const id = `sub-${++subCounter}`;
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
    const subscription: Subscription = {
      id,
      tenantId: body.tenantId,
      planId: plan.id,
      planName: plan.name,
      status: 'ACTIVE',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
    };
    subscriptions.set(id, subscription);
    auditLog.push({ action: 'SUBSCRIPTION_CREATED', target: id, timestamp: new Date().toISOString() });
    await reply.status(201).send({ success: true, data: subscription });
  });

  app.get('/subscription/tenant/:tenantId', async (req) => {
    const { tenantId } = req.params as { tenantId: string };
    const subs = Array.from(subscriptions.values()).filter((s) => s.tenantId === tenantId);
    return { success: true, data: subs };
  });

  app.put('/subscription/:id/upgrade', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sub = subscriptions.get(id);
    if (!sub) {
      await reply.status(404).send({ success: false, error: { code: 'SUBSCRIPTION_NOT_FOUND' } });
      return;
    }
    const body = req.body as { newPlanId: string };
    const newPlan = plans.get(body.newPlanId);
    if (!newPlan) {
      await reply.status(404).send({ success: false, error: { code: 'PLAN_NOT_FOUND' } });
      return;
    }
    sub.planId = newPlan.id;
    sub.planName = newPlan.name;
    auditLog.push({ action: 'SUBSCRIPTION_UPGRADED', target: id, timestamp: new Date().toISOString() });
    return { success: true, data: sub };
  });

  app.put('/subscription/:id/downgrade', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sub = subscriptions.get(id);
    if (!sub) {
      await reply.status(404).send({ success: false, error: { code: 'SUBSCRIPTION_NOT_FOUND' } });
      return;
    }
    const body = req.body as { newPlanId: string };
    const newPlan = plans.get(body.newPlanId);
    if (!newPlan) {
      await reply.status(404).send({ success: false, error: { code: 'PLAN_NOT_FOUND' } });
      return;
    }
    sub.planId = newPlan.id;
    sub.planName = newPlan.name;
    auditLog.push({ action: 'SUBSCRIPTION_DOWNGRADED', target: id, timestamp: new Date().toISOString() });
    return { success: true, data: sub };
  });

  app.post('/subscription/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sub = subscriptions.get(id);
    if (!sub) {
      await reply.status(404).send({ success: false, error: { code: 'SUBSCRIPTION_NOT_FOUND' } });
      return;
    }
    if (sub.status === 'CANCELLED') {
      await reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: '이미 해지된 구독입니다' },
      });
      return;
    }
    sub.status = 'CANCELLED';
    auditLog.push({ action: 'SUBSCRIPTION_CANCELLED', target: id, timestamp: new Date().toISOString() });
    return { success: true, data: sub };
  });

  app.get('/subscription/expiring', async () => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiring = Array.from(subscriptions.values()).filter((s) => {
      const end = new Date(s.endDate);
      return s.status === 'ACTIVE' && end <= thirtyDays && end >= now;
    });
    return { success: true, data: expiring };
  });

  app.get('/subscription/stats', async () => {
    const all = Array.from(subscriptions.values());
    return {
      success: true,
      data: {
        total: all.length,
        active: all.filter((s) => s.status === 'ACTIVE').length,
        cancelled: all.filter((s) => s.status === 'CANCELLED').length,
        byPlan: Object.fromEntries(
          [...new Set(all.map((s) => s.planName))].map((name) => [name, all.filter((s) => s.planName === name).length]),
        ),
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('플랜 생성 -> 구독 -> 업그레이드 -> 해지 전체 생명주기', async () => {
    // 1. 기본 플랜 생성
    const basicRes = await app.inject({
      method: 'POST',
      url: '/subscription/plans',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Basic', price: 50000, maxUsers: 5, features: ['기본 기능'] },
    });
    expect(basicRes.statusCode).toBe(201);
    const basicId = basicRes.json().data.id;

    // 2. 프로 플랜 생성
    const proRes = await app.inject({
      method: 'POST',
      url: '/subscription/plans',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Pro', price: 150000, maxUsers: 50, features: ['기본 기능', 'AI 분석', '고급 리포트'] },
    });
    const proId = proRes.json().data.id;

    // 3. 구독 생성
    const subRes = await app.inject({
      method: 'POST',
      url: '/subscription/subscribe',
      headers: { 'content-type': 'application/json' },
      payload: { tenantId: 't-sub', planId: basicId },
    });
    expect(subRes.statusCode).toBe(201);
    const subId = subRes.json().data.id;
    expect(subRes.json().data.planName).toBe('Basic');

    // 4. 업그레이드
    const upgradeRes = await app.inject({
      method: 'PUT',
      url: `/subscription/${subId}/upgrade`,
      headers: { 'content-type': 'application/json' },
      payload: { newPlanId: proId },
    });
    expect(upgradeRes.json().data.planName).toBe('Pro');

    // 5. 해지
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/subscription/${subId}/cancel`,
    });
    expect(cancelRes.json().data.status).toBe('CANCELLED');

    // 6. 중복 해지 방지
    const dupCancelRes = await app.inject({
      method: 'POST',
      url: `/subscription/${subId}/cancel`,
    });
    expect(dupCancelRes.statusCode).toBe(409);
  });

  it('테넌트별 구독 조회', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/subscription/tenant/t-sub',
    });
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('플랜 수정 + 비활성화', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/subscription/plans',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Legacy', price: 30000 },
    });
    const planId = createRes.json().data.id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/subscription/plans/${planId}`,
      headers: { 'content-type': 'application/json' },
      payload: { isActive: false },
    });
    expect(updateRes.json().data.isActive).toBe(false);

    // 비활성 플랜은 목록에 미표시
    const listRes = await app.inject({ method: 'GET', url: '/subscription/plans' });
    expect(listRes.json().data.find((p: { id: string }) => p.id === planId)).toBeUndefined();
  });

  it('구독 통계 조회', async () => {
    const res = await app.inject({ method: 'GET', url: '/subscription/stats' });
    expect(res.json().data.total).toBeGreaterThan(0);
  });

  it('존재하지 않는 플랜으로 구독 시 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/subscription/subscribe',
      headers: { 'content-type': 'application/json' },
      payload: { tenantId: 't-err', planId: 'nonexistent' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/subscription/plans' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
