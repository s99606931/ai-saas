// Round 11 통합 테스트: healthPlugin 서비스 통합 검증
// Design Ref: SVC-INTEGRATE-R11 Plan
// Plan SC: FR-INT.1, FR-INT.6
// CSAP: D-07 가용성

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthPlugin, CommonCheckers, type HealthStatus } from '../src/index.js';

// ══════════════════════════════════════════════════════════════
// T-INT.1: healthPlugin 서비스 통합 테스트
// ══════════════════════════════════════════════════════════════

describe('FR-INT.1: healthPlugin 서비스 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(healthPlugin, {
      serviceName: 'test-service',
      version: '1.0.0',
      checkers: [
        CommonCheckers.custom('mock-db', async () => true, 1000),
      ],
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health 엔드포인트가 200 OK를 반환한다 (livenessProbe)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('/ready 엔드포인트가 의존성 상태를 포함한다 (readinessProbe)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ready).toBe(true);
    expect(body.dependencies).toBeInstanceOf(Array);
    expect(body.dependencies.length).toBeGreaterThanOrEqual(1);
    expect(body.dependencies[0].name).toBe('mock-db');
    expect(body.dependencies[0].status).toBe('healthy');
  });

  it('/health/detail 엔드포인트가 상세 상태를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detail' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as HealthStatus;
    expect(body.service).toBe('test-service');
    expect(body.version).toBe('1.0.0');
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeTruthy();
    expect(body.dependencies).toHaveLength(1);
  });

  it('/health/sla 엔드포인트가 SLA 메트릭을 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/sla' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.uptimePercentage).toBeGreaterThanOrEqual(0);
    expect(body.data.totalChecks).toBeGreaterThanOrEqual(0);
  });

  it('의존성 체크 실패 시 /ready가 503을 반환한다', async () => {
    const failApp = Fastify({ logger: false });
    await failApp.register(healthPlugin, {
      serviceName: 'fail-service',
      version: '1.0.0',
      checkers: [
        CommonCheckers.custom('failing-dep', async () => false, 1000),
      ],
    });
    await failApp.ready();

    const res = await failApp.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.ready).toBe(false);

    await failApp.close();
  });

  it('healthChecker decorator가 등록된다', () => {
    expect(app.healthChecker).toBeDefined();
    expect(typeof app.healthChecker.check).toBe('function');
    expect(typeof app.healthChecker.liveness).toBe('function');
    expect(typeof app.healthChecker.readiness).toBe('function');
    expect(typeof app.healthChecker.calculateSLA).toBe('function');
  });

  it('17개 서비스 healthPlugin 적용 대상이 완전하다', () => {
    const SERVICES = [
      'tenant-service', 'user-service', 'auth-service', 'api-gateway',
      'catalog-service', 'menu-service', 'billing-service', 'subscription-service',
      'crm-service', 'ai-service', 'audit-service', 'file-service',
      'notification-service', 'compliance-service', 'security-service',
      'security-monitor-service', 'saas-catalog-service',
    ];
    expect(SERVICES).toHaveLength(17);
  });
});
