// 헬스체크 플러그인 테스트
// Design Ref: SVC-HEALTHAGG-R23 Plan
// Plan SC: FR-HA.6
// CSAP: D-10, D-14

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { healthPlugin } from '../src/health-plugin.js';

describe('healthPlugin -- Fastify 통합', () => {
  it('healthAggregator decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    expect(app.healthAggregator).toBeDefined();
    expect(typeof app.healthAggregator.register).toBe('function');

    await app.close();
  });

  it('/health/aggregate 엔드포인트가 집계 결과를 반환한다', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    app.healthAggregator.register({
      name: 'test-svc',
      checker: async () => ({ status: 'healthy', responseTimeMs: 5 }),
    });

    const res = await app.inject({ method: 'GET', url: '/health/aggregate' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('healthy');
    expect(body.data.totalCount).toBe(1);

    await app.close();
  });

  it('/health/services 엔드포인트가 서비스 목록을 반환한다', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    app.healthAggregator.register({
      name: 'svc-a',
      checker: async () => ({ status: 'healthy', responseTimeMs: 5 }),
    });
    app.healthAggregator.register({
      name: 'svc-b',
      checker: async () => ({ status: 'healthy', responseTimeMs: 5 }),
    });

    const res = await app.inject({ method: 'GET', url: '/health/services' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(2);

    await app.close();
  });

  it('/health/services/:name 엔드포인트가 개별 서비스 상태를 반환한다', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    app.healthAggregator.register({
      name: 'auth',
      checker: async () => ({ status: 'healthy', responseTimeMs: 5 }),
    });

    const res = await app.inject({ method: 'GET', url: '/health/services/auth' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('auth');
    expect(body.data.status).toBe('healthy');

    await app.close();
  });

  it('존재하지 않는 서비스 조회 시 404', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health/services/nonexistent' });
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.code).toBe('SERVICE_NOT_FOUND');

    await app.close();
  });

  it('exposeAggregate=false 시 집계 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(healthPlugin, { exposeAggregate: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health/aggregate' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('critical 서비스 실패 시 aggregate가 unhealthy', async () => {
    const app = Fastify();
    await app.register(healthPlugin, {});
    await app.ready();

    app.healthAggregator.register({
      name: 'db',
      critical: true,
      checker: async () => { throw new Error('DB 다운'); },
    });

    const res = await app.inject({ method: 'GET', url: '/health/aggregate' });
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('unhealthy');

    await app.close();
  });
});
