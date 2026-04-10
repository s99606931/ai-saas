// Round 11 통합 테스트: cachePlugin 서비스 통합 검증
// Design Ref: SVC-INTEGRATE-R11 Plan
// Plan SC: FR-INT.2, FR-INT.6
// CSAP: D-07 가용성, D-08-05 테넌트 격리

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { cachePlugin, CacheStore } from '../src/index.js';

// ══════════════════════════════════════════════════════════════
// T-INT.2: cachePlugin 서비스 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.2: cachePlugin 서비스 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(cachePlugin, {
      config: { defaultTtlSeconds: 300, prefix: 'test' },
    });

    // 캐시 사용 테스트 라우트
    app.get('/items', async (request, reply) => {
      const cache = app.cache;
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'default';
      const key = cache.buildKey('test', tenantId, 'items', 'all');
      const cached = cache.get<{ items: string[] }>(key);

      if (cached) {
        void reply.header('X-Cache', 'HIT');
        return cached;
      }

      const data = { items: ['item1', 'item2', 'item3'] };
      cache.set(key, data, tenantId, 300);
      void reply.header('X-Cache', 'MISS');
      return data;
    });

    // 캐시 무효화 테스트 라우트
    app.post('/items', async (request, reply) => {
      const cache = app.cache;
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'default';
      // 캐시 키 패턴: {prefix}:{service}:{tenantId}:{resource}:{identifier}
      cache.deleteByPattern(`test:test:${tenantId}:items:*`);
      void reply.status(201);
      return { success: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cache decorator가 등록된다', () => {
    expect(app.cache).toBeDefined();
    expect(app.cache).toBeInstanceOf(CacheStore);
  });

  it('첫 번째 요청에서 X-Cache: MISS 헤더를 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.json().items).toHaveLength(3);
  });

  it('두 번째 요청에서 X-Cache: HIT 헤더를 반환한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.json().items).toHaveLength(3);
  });

  it('다른 테넌트의 캐시가 격리된다 (CSAP D-08-05)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-002' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('CUD 작업 후 캐시가 무효화된다', async () => {
    await app.inject({
      method: 'POST',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
      payload: {},
    });

    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-001' },
    });
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('캐시 통계가 올바르게 집계된다', () => {
    const stats = app.cache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.hitRate).toBeLessThanOrEqual(1);
  });

  it('테넌트별 캐시 무효화가 동작한다', async () => {
    // t-002 캐시를 먼저 확보
    await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-002' },
    });

    const deleted = app.cache.invalidateTenant('t-002');
    expect(deleted).toBeGreaterThanOrEqual(1);

    // 무효화 후 MISS
    const res = await app.inject({
      method: 'GET',
      url: '/items',
      headers: { 'x-tenant-id': 't-002' },
    });
    expect(res.headers['x-cache']).toBe('MISS');
  });
});
