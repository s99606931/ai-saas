// 알림 서비스 E2E 통합 테스트 -- Round 4/5
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.3
// CSAP: D-06 감사 로그

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('notification-service E2E -- 알림 워크플로 + 관측성', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  type NotifStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRY';
  const notifications: Array<{
    id: string;
    tenantId: string;
    type: string;
    recipient: string;
    status: NotifStatus;
    retryCount: number;
    createdAt: string;
  }> = [];

  app.get('/health', async () => ({ status: 'ok', service: 'notification-service' }));

  app.post('/notifications', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    const body = req.body as { type: string; recipient: string };
    const notif = {
      id: `n-${Date.now()}-${notifications.length}`,
      tenantId,
      type: body.type,
      recipient: body.recipient,
      status: 'PENDING' as NotifStatus,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    notifications.push(notif);
    return { success: true, data: notif };
  });

  app.post('/notifications/:id/send', async (req, reply) => {
    const { id } = req.params as { id: string };
    const notif = notifications.find((n) => n.id === id);
    if (!notif) {
      await reply.status(404).send({ error: 'NOT_FOUND' });
      return;
    }
    notif.status = 'SENT';
    return { success: true, data: notif };
  });

  app.post('/notifications/:id/retry', async (req, reply) => {
    const { id } = req.params as { id: string };
    const notif = notifications.find((n) => n.id === id);
    if (!notif) {
      await reply.status(404).send({ error: 'NOT_FOUND' });
      return;
    }
    if (notif.retryCount >= 3) {
      notif.status = 'FAILED';
      return { success: false, data: notif, message: '최대 재시도 횟수 초과' };
    }
    notif.retryCount += 1;
    notif.status = 'RETRY';
    return { success: true, data: notif };
  });

  app.get('/notifications/stats', async (req, reply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      await reply.status(400).send({ error: 'TENANT_REQUIRED' });
      return;
    }
    const filtered = notifications.filter((n) => n.tenantId === tenantId);
    const byStatus: Record<string, number> = {};
    for (const n of filtered) {
      byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
    }
    return { success: true, data: { byStatus, total: filtered.length } };
  });

  beforeEach(() => {
    notifications.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('알림 생성 -> 발송 플로우', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/notifications',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { type: 'EMAIL', recipient: 'user@test.com' },
    });
    const id = createRes.json().data.id;
    expect(createRes.json().data.status).toBe('PENDING');

    const sendRes = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/send`,
    });
    expect(sendRes.json().data.status).toBe('SENT');
  });

  it('재시도 3회 초과 시 FAILED', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/notifications',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { type: 'SMS', recipient: '010-1234-5678' },
    });
    const id = createRes.json().data.id;

    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'POST', url: `/notifications/${id}/retry` });
    }

    const finalRes = await app.inject({ method: 'POST', url: `/notifications/${id}/retry` });
    expect(finalRes.json().data.status).toBe('FAILED');
  });

  it('테넌트별 알림 통계', async () => {
    await app.inject({
      method: 'POST',
      url: '/notifications',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { type: 'EMAIL', recipient: 'a@test.com' },
    });
    await app.inject({
      method: 'POST',
      url: '/notifications',
      headers: { 'x-tenant-id': 't1', 'content-type': 'application/json' },
      payload: { type: 'EMAIL', recipient: 'b@test.com' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/stats',
      headers: { 'x-tenant-id': 't1' },
    });
    expect(res.json().data.total).toBe(2);
    expect(res.json().data.byStatus.PENDING).toBe(2);
  });

  it('X-Response-Time 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
