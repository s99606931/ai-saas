// Gateway Advanced 플러그인 테스트
// Design Ref: SVC-APIGW-R22 Plan
// Plan SC: FR-GW.5
// CSAP: D-08, D-10

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { gatewayPlugin } from '../src/gateway-plugin.js';

describe('gatewayPlugin -- Fastify 통합', () => {
  it('gateway decorator가 등록된다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, {});
    await app.ready();

    expect(app.gateway).toBeDefined();
    expect(app.gateway.cache).toBeDefined();
    expect(app.gateway.analytics).toBeDefined();
    expect(app.gateway.aggregator).toBeDefined();

    await app.close();
  });

  it('/gateway/cache/stats 엔드포인트가 캐시 통계를 반환한다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, {});
    await app.ready();

    // 캐시에 데이터 추가
    app.gateway.cache.set('key-1', 'value-1');
    app.gateway.cache.get('key-1');

    const res = await app.inject({ method: 'GET', url: '/gateway/cache/stats' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.hits).toBe(1);
    expect(body.data.size).toBe(1);

    await app.close();
  });

  it('/gateway/analytics 엔드포인트가 사용량 리포트를 반환한다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, {});
    await app.ready();

    app.gateway.analytics.record({
      method: 'GET',
      path: '/api/users',
      statusCode: 200,
      responseTimeMs: 50,
    });

    const res = await app.inject({ method: 'GET', url: '/gateway/analytics' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.data.totalRequests).toBe(1);
    expect(body.data.endpoints[0].path).toBe('/api/users');

    await app.close();
  });

  it('exposeCacheStats=false 시 캐시 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, { exposeCacheStats: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/gateway/cache/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('exposeAnalytics=false 시 분석 엔드포인트가 없다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, { exposeAnalytics: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/gateway/analytics' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('aggregator를 통해 병렬 요청을 수행할 수 있다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, {});
    await app.ready();

    const result = await app.gateway.aggregator.aggregate([
      { key: 'a', execute: async () => 'data-a' },
      { key: 'b', execute: async () => 'data-b' },
    ]);

    expect(result.success).toBe(true);
    expect(result.data.a).toBe('data-a');
    expect(result.data.b).toBe('data-b');

    await app.close();
  });

  it('onClose 시 캐시 리소스가 정리된다', async () => {
    const app = Fastify();
    await app.register(gatewayPlugin, {
      cacheOptions: { cleanupIntervalMs: 100 },
    });
    await app.ready();

    app.gateway.cache.set('key', 'value');
    await app.close();

    // close 후 캐시가 비워졌는지 확인
    expect(app.gateway.cache.getSize()).toBe(0);
  });
});
