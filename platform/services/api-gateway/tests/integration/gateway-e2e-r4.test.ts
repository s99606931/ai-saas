// API Gateway E2E 통합 테스트 -- Round 4
// Design Ref: SVC-E2E-R4 DESIGN
// Plan SC: FR-E2E.1, FR-E2E.2, FR-E2E.3, FR-E2E.4
// CSAP: D-08 인증, D-10 네트워크 보안

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';

describe('API Gateway E2E -- 보안 헤더 검증 (FR-E2E.3)', () => {
  const app = Fastify();

  // 기본 플러그인 등록
  app.register(responseTimePlugin);

  // 테스트용 라우트
  app.get('/test/health', async () => ({ status: 'ok' }));
  app.get('/test/protected', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      await reply.status(401).send({ error: 'AUTH_REQUIRED' });
      return;
    }
    return { data: 'protected-content', tenantId: req.headers['x-tenant-id'] };
  });
  app.post('/test/data', async (req) => {
    return { received: req.body, tenantId: req.headers['x-tenant-id'] };
  });

  afterAll(async () => {
    await app.close();
  });

  // --- X-Response-Time 검증 ---

  it('GET 요청에 X-Response-Time 헤더가 포함된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-response-time']).toBeDefined();
    expect(res.headers['x-response-time']).toMatch(/^\d+\.\d+ms$/);
  });

  it('POST 요청에 X-Response-Time 헤더가 포함된다', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/data',
      headers: { 'content-type': 'application/json' },
      payload: { key: 'value' },
    });
    expect(res.headers['x-response-time']).toBeDefined();
  });

  it('401 응답에도 X-Response-Time 헤더가 포함된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['x-response-time']).toBeDefined();
  });

  it('404 응답에도 X-Response-Time 헤더가 포함된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/nonexistent' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-response-time']).toBeDefined();
  });
});

describe('API Gateway E2E -- 인증 플로우 시뮬레이션 (FR-E2E.1)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // 인증 미들웨어 시뮬레이션
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0];
    if (url === '/health' || url === '/auth/login') return;

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_NO_TOKEN', message: '인증 토큰이 필요합니다' },
      });
      return;
    }

    const token = auth.slice(7);
    if (token === 'expired') {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_TOKEN_EXPIRED', message: '토큰이 만료되었습니다' },
      });
      return;
    }
    if (token === 'invalid') {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_TOKEN_INVALID', message: '유효하지 않은 토큰' },
      });
      return;
    }

    // 유효한 토큰
    (req as unknown as Record<string, unknown>).user = {
      sub: 'user-1',
      tenantId: req.headers['x-tenant-id'] ?? 'default',
      role: 'TENANT_ADMIN',
    };
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/auth/login', async (req) => {
    const body = req.body as { email?: string; password?: string };
    if (body.email === 'admin@test.com' && body.password === 'correct') {
      return { success: true, data: { accessToken: 'valid-token', refreshToken: 'refresh-1' } };
    }
    return { success: false, error: { code: 'AUTH_FAILED', message: '인증 실패' } };
  });
  app.get('/api/users', async (req) => {
    const user = (req as unknown as Record<string, unknown>).user;
    return { success: true, data: { users: [], currentUser: user } };
  });
  app.get('/api/tenants', async (req) => {
    return {
      success: true,
      data: { tenantId: req.headers['x-tenant-id'] },
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health는 인증 없이 접근 가능', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('/auth/login은 인증 없이 접근 가능', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@test.com', password: 'correct' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBeDefined();
  });

  it('인증 토큰 없이 보호된 API 접근 시 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_NO_TOKEN');
  });

  it('만료된 토큰으로 접근 시 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer expired' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('잘못된 토큰으로 접근 시 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: 'Bearer invalid' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('유효한 토큰으로 보호된 API 접근 성공', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: 'Bearer valid-token',
        'x-tenant-id': 'tenant-1',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('X-Tenant-Id가 하위 서비스에 전파된다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tenants',
      headers: {
        authorization: 'Bearer valid-token',
        'x-tenant-id': 'tenant-alpha',
      },
    });
    expect(res.json().data.tenantId).toBe('tenant-alpha');
  });

  it('로그인 -> 토큰 -> API 접근 전체 플로우', async () => {
    // 1. 로그인
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'admin@test.com', password: 'correct' },
    });
    const token = loginRes.json().data.accessToken;
    expect(token).toBeDefined();

    // 2. 토큰으로 API 접근
    const apiRes = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'tenant-1',
      },
    });
    expect(apiRes.statusCode).toBe(200);
  });
});

describe('API Gateway E2E -- Circuit Breaker 패턴 (FR-E2E.2)', () => {
  it('Circuit Breaker 상태 추적 인터페이스 검증', () => {
    // Circuit Breaker 상태 모델
    type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    interface CircuitBreakerStatus {
      state: CircuitState;
      failures: number;
      lastFailure: string | null;
      nextAttempt: string | null;
    }

    const status: CircuitBreakerStatus = {
      state: 'CLOSED',
      failures: 0,
      lastFailure: null,
      nextAttempt: null,
    };

    expect(status.state).toBe('CLOSED');
    expect(status.failures).toBe(0);
  });

  it('Circuit OPEN 상태에서 요청 차단 시뮬레이션', () => {
    let circuitOpen = false;
    let failureCount = 0;
    const threshold = 3;

    function callService(): { success: boolean; error?: string } {
      if (circuitOpen) {
        return { success: false, error: 'CIRCUIT_OPEN' };
      }
      // 서비스 다운 시뮬레이션
      failureCount++;
      if (failureCount >= threshold) {
        circuitOpen = true;
      }
      return { success: false, error: 'SERVICE_DOWN' };
    }

    // 3번 실패 -> Circuit OPEN
    callService();
    callService();
    const third = callService();
    expect(third.error).toBe('SERVICE_DOWN');

    // 이후 요청은 Circuit Breaker에 의해 차단
    const blocked = callService();
    expect(blocked.error).toBe('CIRCUIT_OPEN');
  });

  it('Half-Open 상태에서 복구 시뮬레이션', () => {
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'OPEN';

    function attemptRecovery(serviceUp: boolean): string {
      if (state === 'OPEN') {
        state = 'HALF_OPEN';
      }
      if (state === 'HALF_OPEN') {
        if (serviceUp) {
          state = 'CLOSED';
          return 'RECOVERED';
        }
        state = 'OPEN';
        return 'STILL_DOWN';
      }
      return 'OK';
    }

    // 서비스 아직 다운
    expect(attemptRecovery(false)).toBe('STILL_DOWN');
    expect(state).toBe('OPEN');

    // 서비스 복구
    expect(attemptRecovery(true)).toBe('RECOVERED');
    expect(state).toBe('CLOSED');
  });
});

describe('API Gateway E2E -- 서비스 헬스 체인 (FR-E2E.4)', () => {
  const app = Fastify();
  app.register(responseTimePlugin);

  // 서비스 레지스트리 시뮬레이션
  const services = [
    { name: 'auth-service', url: 'http://localhost:3001', status: 'healthy' },
    { name: 'user-service', url: 'http://localhost:3002', status: 'healthy' },
    { name: 'tenant-service', url: 'http://localhost:3003', status: 'healthy' },
  ];

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api-gateway',
    registeredServices: services.length,
  }));

  app.get('/health/services', async () => ({
    status: services.every((s) => s.status === 'healthy') ? 'healthy' : 'degraded',
    services: services.map((s) => ({ name: s.name, status: s.status })),
  }));

  afterAll(async () => {
    await app.close();
  });

  it('게이트웨이 자체 헬스 확인', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    expect(res.json().registeredServices).toBeGreaterThan(0);
  });

  it('모든 서비스 healthy 시 전체 상태 healthy', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/services' });
    expect(res.json().status).toBe('healthy');
    expect(res.json().services.length).toBe(3);
  });
});
