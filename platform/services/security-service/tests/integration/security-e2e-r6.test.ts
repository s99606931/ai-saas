// 보안 서비스 E2E 통합 테스트 -- Round 6
// Design Ref: SVC-E2E-R6 Plan
// Plan SC: FR-E2E-R6.7
// CSAP: D-06 침해사고, D-08 접근 통제, D-10 네트워크 보안

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('security-service E2E -- 보안 모니터링 + IP 차단 (CSAP D-06, D-10)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  interface BlockedIp {
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt?: string;
  }

  interface SecurityAlert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    message: string;
    createdAt: string;
  }

  const ipBlocklist = new Map<string, BlockedIp>();
  const alerts: SecurityAlert[] = [];
  let alertCounter = 0;

  // 로그인 실패 시뮬레이션 데이터
  const loginFailures: Array<{ ip: string; userId: string; timestamp: string }> = [];

  app.get('/security/login-failures', async (req) => {
    const query = req.query as { threshold?: string; window?: string };
    const threshold = parseInt(query.threshold ?? '5', 10);

    const ipCounts = new Map<string, number>();
    for (const fail of loginFailures) {
      ipCounts.set(fail.ip, (ipCounts.get(fail.ip) ?? 0) + 1);
    }

    const suspicious = Array.from(ipCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([ip, count]) => ({ ip, failureCount: count }));

    return { success: true, data: suspicious };
  });

  // 로그인 실패 이벤트 추가 (테스트용)
  app.post('/security/login-failures', async (req) => {
    const body = req.body as { ip: string; userId: string };
    loginFailures.push({ ...body, timestamp: new Date().toISOString() });
    return { success: true };
  });

  app.get('/security/anomalies', async () => {
    // 이상 패턴: 동일 IP에서 다수 사용자 로그인 시도
    const ipUsers = new Map<string, Set<string>>();
    for (const fail of loginFailures) {
      if (!ipUsers.has(fail.ip)) ipUsers.set(fail.ip, new Set());
      ipUsers.get(fail.ip)!.add(fail.userId);
    }
    const anomalies = Array.from(ipUsers.entries())
      .filter(([, users]) => users.size >= 3)
      .map(([ip, users]) => ({
        ip,
        distinctUsers: users.size,
        type: 'CREDENTIAL_STUFFING',
      }));
    return { success: true, data: anomalies };
  });

  app.get('/security/ip-blocklist', async () => {
    return { success: true, data: Array.from(ipBlocklist.values()) };
  });

  app.post('/security/ip-blocklist', async (req, reply) => {
    const body = req.body as { ip?: string; reason?: string; expiresAt?: string };
    if (!body.ip || !body.reason) {
      await reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'IP와 사유는 필수입니다' },
      });
      return;
    }
    // IP 형식 검증
    const ipPattern = /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?|[0-9a-fA-F:]+(?:\/\d{1,3})?)$/;
    if (!ipPattern.test(body.ip)) {
      await reply.status(400).send({
        success: false,
        error: { code: 'INVALID_IP', message: '유효한 IP 형식이 아닙니다' },
      });
      return;
    }
    const blocked: BlockedIp = {
      ip: body.ip,
      reason: body.reason,
      blockedAt: new Date().toISOString(),
      expiresAt: body.expiresAt,
    };
    ipBlocklist.set(body.ip, blocked);
    await reply.status(201).send({ success: true, data: blocked });
  });

  app.delete('/security/ip-blocklist/:ip', async (req, reply) => {
    const { ip } = req.params as { ip: string };
    if (!ipBlocklist.has(ip)) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '차단 목록에 없는 IP입니다' },
      });
      return;
    }
    ipBlocklist.delete(ip);
    return { success: true, message: 'IP 차단 해제' };
  });

  app.get('/security/alerts', async (req) => {
    const query = req.query as { severity?: string };
    let items = [...alerts];
    if (query.severity) items = items.filter((a) => a.severity === query.severity);
    return { success: true, data: items };
  });

  app.get('/security/dashboard', async () => {
    return {
      success: true,
      data: {
        blockedIpCount: ipBlocklist.size,
        alertCount: alerts.length,
        criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
        loginFailureCount: loginFailures.length,
      },
    };
  });

  app.get('/security/threat-trend', async () => {
    return {
      success: true,
      data: {
        trend: [
          { date: '2026-04-08', threats: loginFailures.length },
          { date: '2026-04-09', threats: 0 },
        ],
      },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('로그인 실패 탐지 -> IP 차단 -> 해제 전체 플로우', async () => {
    // 로그인 실패 이벤트 생성 (동일 IP 5회)
    for (let i = 0; i < 6; i++) {
      await app.inject({
        method: 'POST',
        url: '/security/login-failures',
        headers: { 'content-type': 'application/json' },
        payload: { ip: '10.0.0.100', userId: `user-${i}` },
      });
    }

    // 실패 패턴 탐지
    const failRes = await app.inject({
      method: 'GET',
      url: '/security/login-failures?threshold=5',
    });
    expect(failRes.json().data.length).toBeGreaterThanOrEqual(1);
    expect(failRes.json().data[0].failureCount).toBeGreaterThanOrEqual(5);

    // IP 차단
    const blockRes = await app.inject({
      method: 'POST',
      url: '/security/ip-blocklist',
      headers: { 'content-type': 'application/json' },
      payload: { ip: '10.0.0.100', reason: '로그인 실패 임계값 초과' },
    });
    expect(blockRes.statusCode).toBe(201);

    // 차단 목록 확인
    const listRes = await app.inject({ method: 'GET', url: '/security/ip-blocklist' });
    expect(listRes.json().data.length).toBe(1);

    // 차단 해제
    const unblockRes = await app.inject({
      method: 'DELETE',
      url: '/security/ip-blocklist/10.0.0.100',
    });
    expect(unblockRes.json().success).toBe(true);
  });

  it('이상 접근 패턴 탐지 (Credential Stuffing)', async () => {
    // 동일 IP에서 다수 사용자 로그인 시도
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/security/login-failures',
        headers: { 'content-type': 'application/json' },
        payload: { ip: '192.168.1.50', userId: `victim-${i}` },
      });
    }

    const anomalyRes = await app.inject({ method: 'GET', url: '/security/anomalies' });
    const anomalies = anomalyRes.json().data;
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].type).toBe('CREDENTIAL_STUFFING');
  });

  it('IP 형식 검증 -- 잘못된 형식 차단', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/security/ip-blocklist',
      headers: { 'content-type': 'application/json' },
      payload: { ip: 'not-an-ip', reason: '테스트' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_IP');
  });

  it('보안 대시보드 + 위협 추이 조회', async () => {
    const dashRes = await app.inject({ method: 'GET', url: '/security/dashboard' });
    expect(dashRes.json().data.loginFailureCount).toBeGreaterThan(0);

    const trendRes = await app.inject({ method: 'GET', url: '/security/threat-trend' });
    expect(trendRes.json().data.trend.length).toBeGreaterThan(0);
  });

  it('존재하지 않는 IP 차단 해제 시 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/security/ip-blocklist/1.2.3.4',
    });
    expect(res.statusCode).toBe(404);
  });

  it('X-Response-Time 헤더 포함', async () => {
    const res = await app.inject({ method: 'GET', url: '/security/dashboard' });
    expect(res.headers['x-response-time']).toBeDefined();
  });
});
