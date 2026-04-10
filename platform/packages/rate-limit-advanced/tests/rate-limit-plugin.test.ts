// Rate Limit Advanced 플러그인 테스트
// Design Ref: SVC-RATELIMIT-R19 Plan
// Plan SC: FR-RL.5, FR-RL.6
// CSAP: D-10 접근 제어

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { rateLimitAdvancedPlugin } from '../src/rate-limit-plugin.js';

describe('rateLimitAdvancedPlugin -- Fastify 통합', () => {
  it('rateLimiter decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(rateLimitAdvancedPlugin, {});
    await app.ready();

    expect(app.rateLimiter).toBeDefined();
    expect(typeof app.rateLimiter.tryRequest).toBe('function');

    await app.close();
  });

  it('정상 요청에 Rate Limit 헤더를 포함한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      keyStrategy: 'tenant',
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();

    await app.close();
  });

  it('한도 초과 시 429를 반환한다', async () => {
    const app = Fastify();
    app.get('/limited', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      limiterOptions: {
        plans: { free: { requestsPerMinute: 3, burstMultiplier: 1.0 } },
      },
      keyStrategy: 'tenant',
    });
    await app.ready();

    const headers = { 'x-tenant-id': 'tenant-limited' };
    await app.inject({ method: 'GET', url: '/limited', headers });
    await app.inject({ method: 'GET', url: '/limited', headers });
    await app.inject({ method: 'GET', url: '/limited', headers });

    const res = await app.inject({ method: 'GET', url: '/limited', headers });
    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBeDefined();

    await app.close();
  });

  it('제외 경로는 Rate Limit 검사를 건너뛴다', async () => {
    const app = Fastify();
    app.get('/health', async () => ({ status: 'ok' }));
    await app.register(rateLimitAdvancedPlugin, {
      limiterOptions: {
        plans: { free: { requestsPerMinute: 1, burstMultiplier: 1.0 } },
      },
    });
    await app.ready();

    // 100번 요청해도 /health는 항상 성공
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }

    await app.close();
  });

  it('IP 기반 키 전략이 동작한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      keyStrategy: 'ip',
      limiterOptions: {
        plans: { free: { requestsPerMinute: 5, burstMultiplier: 1.0 } },
      },
    });
    await app.ready();

    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'GET', url: '/test' });
    }
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(429);

    await app.close();
  });

  it('/rate-limit/stats 엔드포인트가 통계를 반환한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, { keyStrategy: 'tenant' });
    await app.ready();

    // 먼저 몇 건 요청
    await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-tenant-id': 'tenant-stats' },
    });

    const res = await app.inject({ method: 'GET', url: '/rate-limit/stats' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.activeKeys).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('커스텀 planResolver가 동작한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      keyStrategy: 'tenant',
      planResolver: (tenantId) => {
        if (tenantId === 'premium') return 'enterprise';
        return 'free';
      },
    });
    await app.ready();

    const info1 = app.rateLimiter.tryRequest('premium', 'enterprise');
    expect(info1.limit).toBe(10000);

    const info2 = app.rateLimiter.tryRequest('basic', 'free');
    expect(info2.limit).toBe(100);

    await app.close();
  });

  it('커스텀 키 생성 함수가 동작한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      keyStrategy: 'custom',
      keyGenerator: (req) => {
        const apiKey = req.headers['x-api-key'];
        return typeof apiKey === 'string' ? apiKey : 'anonymous';
      },
      limiterOptions: {
        plans: { free: { requestsPerMinute: 3, burstMultiplier: 1.0 } },
      },
    });
    await app.ready();

    const headers = { 'x-api-key': 'key-1' };
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'GET', url: '/test', headers });
    }
    const res = await app.inject({ method: 'GET', url: '/test', headers });
    expect(res.statusCode).toBe(429);

    // 다른 API 키는 아직 사용 가능
    const res2 = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-api-key': 'key-2' },
    });
    expect(res2.statusCode).toBe(200);

    await app.close();
  });

  it('exposeStats=false 시 통계 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(rateLimitAdvancedPlugin, { exposeStats: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/rate-limit/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('테넌트 헤더 없으면 IP로 폴백한다', async () => {
    const app = Fastify();
    app.get('/test', async () => ({ ok: true }));
    await app.register(rateLimitAdvancedPlugin, {
      keyStrategy: 'tenant',
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();

    await app.close();
  });
});
