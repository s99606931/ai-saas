// @public-saas/health Fastify 플러그인 통합 테스트
// Design Ref: SVC-HEALTH-R10 Plan
// Plan SC: FR-HEALTH.2
// CSAP: D-07 가용성

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { healthPlugin } from '../src/health-plugin.js';

describe('Health 플러그인 -- E2E', () => {
  const app = Fastify();

  app.register(healthPlugin, {
    serviceName: 'test-api',
    version: '2.0.0',
    checkers: [
      {
        name: 'database',
        check: async () => ({ healthy: true, message: 'PostgreSQL connected' }),
      },
      {
        name: 'redis',
        check: async () => ({ healthy: true, message: 'Redis connected' }),
      },
    ],
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health -- 라이브니스 프로브', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    expect(res.json().uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /ready -- 레디니스 프로브 (모든 의존성 healthy)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ready).toBe(true);
    expect(res.json().dependencies).toHaveLength(2);
  });

  it('GET /health/detail -- 상세 상태', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detail' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.service).toBe('test-api');
    expect(body.version).toBe('2.0.0');
    expect(body.status).toBe('healthy');
    expect(body.dependencies).toHaveLength(2);
    expect(body.dependencies[0].name).toBe('database');
    expect(body.dependencies[0].status).toBe('healthy');
  });

  it('GET /health/sla -- SLA 메트릭', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/sla' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.totalChecks).toBeGreaterThan(0);
    expect(res.json().data.uptimePercentage).toBe(100);
  });
});

describe('Health 플러그인 -- Unhealthy 의존성', () => {
  const app = Fastify();

  app.register(healthPlugin, {
    serviceName: 'broken-api',
    checkers: [
      {
        name: 'database',
        check: async () => ({ healthy: false, message: 'Connection refused' }),
      },
    ],
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ready -- 503 반환 (의존성 unhealthy)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json().ready).toBe(false);
  });

  it('GET /health -- 라이브니스는 여전히 200 (서비스 자체는 살아있음)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
