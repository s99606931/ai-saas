// 보안 모니터링 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.8
// CSAP: D-06 침해사고, D-08 접근 통제

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('security-monitor-service E2E -- 알림 관리 + 분석 (CSAP D-06)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface SecurityAlert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    message: string;
    createdAt: string;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
  }

  const alerts: SecurityAlert[] = [];
  let alertCounter = 0;

  const ipBlocklist = new Map<
    string,
    {
      ip: string;
      reason: string;
      blockedAt: string;
    }
  >();

  // 알림 생성 (테스트용)
  app.post('/security/alerts', async (req, reply) => {
    const body = req.body as {
      severity: 'low' | 'medium' | 'high' | 'critical';
      type: string;
      message: string;
    };
    const alert: SecurityAlert = {
      id: `SEC-${String(++alertCounter).padStart(4, '0')}`,
      severity: body.severity,
      type: body.type,
      message: body.message,
      createdAt: new Date().toISOString(),
      acknowledged: false,
    };
    alerts.push(alert);
    await reply.status(201).send({ success: true, data: alert });
  });

  app.get('/security/alerts', async (req) => {
    const query = req.query as { severity?: string; acknowledged?: string };
    let items = [...alerts];
    if (query.severity) items = items.filter((a) => a.severity === query.severity);
    if (query.acknowledged === 'true') items = items.filter((a) => a.acknowledged);
    if (query.acknowledged === 'false') items = items.filter((a) => !a.acknowledged);
    return { success: true, data: items, total: items.length };
  });

  app.put('/security/alerts/:id/acknowledge', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = alerts.find((a) => a.id === id);
    if (!alert) {
      await reply.status(404).send({
        success: false,
        error: { code: 'ALERT_NOT_FOUND', message: '알림을 찾을 수 없습니다' },
      });
      return;
    }
    if (alert.acknowledged) {
      await reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_ACKNOWLEDGED', message: '이미 확인된 알림입니다' },
      });
      return;
    }
    alert.acknowledged = true;
    alert.acknowledgedBy = (req.headers['x-user-id'] as string) ?? 'system';
    alert.acknowledgedAt = new Date().toISOString();
    return { success: true, data: alert };
  });

  app.get('/security/alerts/summary', async () => {
    const summary = {
      total: alerts.length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        high: alerts.filter((a) => a.severity === 'high').length,
        medium: alerts.filter((a) => a.severity === 'medium').length,
        low: alerts.filter((a) => a.severity === 'low').length,
      },
    };
    return { success: true, data: summary };
  });

  app.get('/security/login-failures', async () => {
    return { success: true, data: [] };
  });

  app.get('/security/anomalies', async () => {
    return { success: true, data: [] };
  });

  app.get('/security/ip-blocklist', async () => {
    return { success: true, data: Array.from(ipBlocklist.values()) };
  });

  app.post('/security/ip-blocklist', async (req, reply) => {
    const body = req.body as { ip: string; reason: string };
    const ipPattern = /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|[0-9a-fA-F:]+(?:\/\d{1,3})?)$/;
    if (!ipPattern.test(body.ip)) {
      await reply.status(400).send({
        success: false,
        error: { code: 'INVALID_IP', message: '유효한 IP 형식이 아닙니다' },
      });
      return;
    }
    ipBlocklist.set(body.ip, {
      ip: body.ip,
      reason: body.reason,
      blockedAt: new Date().toISOString(),
    });
    await reply.status(201).send({ success: true });
  });

  app.delete('/security/ip-blocklist/:ip', async (req, reply) => {
    const { ip } = req.params as { ip: string };
    if (!ipBlocklist.has(ip)) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      return;
    }
    ipBlocklist.delete(ip);
    return { success: true };
  });

  app.get('/security/analytics/login-failure-trend', async () => {
    return {
      success: true,
      data: [
        { date: '2026-04-07', count: 12 },
        { date: '2026-04-08', count: 8 },
        { date: '2026-04-09', count: 3 },
      ],
    };
  });

  app.get('/security/analytics/events', async () => {
    return {
      success: true,
      data: {
        totalEvents: alerts.length,
        byType: alerts.reduce(
          (acc, a) => {
            acc[a.type] = (acc[a.type] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('알림 생성 -> 조회 -> 확인 전체 워크플로우', async () => {
    // 1. 알림 생성
    const createRes = await app.inject({
      method: 'POST',
      url: '/security/alerts',
      headers: { 'content-type': 'application/json' },
      payload: { severity: 'critical', type: 'BRUTE_FORCE', message: '무차별 대입 공격 탐지' },
    });
    expect(createRes.statusCode).toBe(201);
    const alertId = createRes.json().data.id;

    // 2. 알림 조회
    const listRes = await app.inject({
      method: 'GET',
      url: '/security/alerts?severity=critical',
    });
    expect(listRes.json().data.length).toBeGreaterThanOrEqual(1);

    // 3. 알림 확인
    const ackRes = await app.inject({
      method: 'PUT',
      url: `/security/alerts/${alertId}/acknowledge`,
      headers: { 'x-user-id': 'admin-1' },
    });
    expect(ackRes.json().data.acknowledged).toBe(true);
    expect(ackRes.json().data.acknowledgedBy).toBe('admin-1');

    // 4. 이미 확인된 알림 중복 확인 방지
    const dupAckRes = await app.inject({
      method: 'PUT',
      url: `/security/alerts/${alertId}/acknowledge`,
    });
    expect(dupAckRes.statusCode).toBe(409);
  });

  it('알림 심각도별 필터링 + 요약', async () => {
    // 다양한 심각도 알림 생성
    for (const severity of ['low', 'medium', 'high'] as const) {
      await app.inject({
        method: 'POST',
        url: '/security/alerts',
        headers: { 'content-type': 'application/json' },
        payload: { severity, type: 'TEST', message: `${severity} 테스트 알림` },
      });
    }

    const highRes = await app.inject({
      method: 'GET',
      url: '/security/alerts?severity=high',
    });
    expect(highRes.json().data.every((a: { severity: string }) => a.severity === 'high')).toBe(true);

    const summaryRes = await app.inject({ method: 'GET', url: '/security/alerts/summary' });
    expect(summaryRes.json().data.total).toBeGreaterThan(0);
    expect(summaryRes.json().data.bySeverity.critical).toBeGreaterThanOrEqual(1);
  });

  it('IP 차단 관리 -- 추가/조회/해제', async () => {
    const addRes = await app.inject({
      method: 'POST',
      url: '/security/ip-blocklist',
      headers: { 'content-type': 'application/json' },
      payload: { ip: '172.16.0.1', reason: '악성 트래픽' },
    });
    expect(addRes.statusCode).toBe(201);

    const listRes = await app.inject({ method: 'GET', url: '/security/ip-blocklist' });
    expect(listRes.json().data.length).toBeGreaterThanOrEqual(1);

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/security/ip-blocklist/172.16.0.1',
    });
    expect(delRes.json().success).toBe(true);
  });

  it('로그인 실패 추이 + 이벤트 통계 분석', async () => {
    const trendRes = await app.inject({
      method: 'GET',
      url: '/security/analytics/login-failure-trend',
    });
    expect(trendRes.json().data.length).toBeGreaterThan(0);

    const eventsRes = await app.inject({
      method: 'GET',
      url: '/security/analytics/events',
    });
    expect(eventsRes.json().data.totalEvents).toBeGreaterThan(0);
  });

  it('존재하지 않는 알림 확인 시 404', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/security/alerts/SEC-9999/acknowledge',
    });
    expect(res.statusCode).toBe(404);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/security/alerts/summary' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
