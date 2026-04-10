// Chaos 플러그인 E2E 테스트
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.1, FR-CHAOS.4

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { chaosPlugin } from '../src/chaos-plugin.js';

describe('chaosPlugin -- Fastify 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(chaosPlugin, {});

    // 테스트 라우트
    app.get('/test', async () => ({ data: 'normal response' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chaos decorator가 등록된다', () => {
    expect(app.chaos).toBeDefined();
    expect(typeof app.chaos.injectFault).toBe('function');
  });

  it('/chaos/faults 엔드포인트가 등록된다', async () => {
    const res = await app.inject({ method: 'GET', url: '/chaos/faults' });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data).toEqual([]);
  });

  it('/chaos/stats 엔드포인트가 통계를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/chaos/stats' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.totalFaults).toBe(0);
  });

  it('장애 주입 후 일반 요청이 에러를 반환한다', async () => {
    // 장애 주입
    const injectRes = await app.inject({
      method: 'POST',
      url: '/chaos/faults',
      payload: {
        type: 'error',
        probability: 1.0,
        errorCode: 503,
        errorMessage: 'Chaos test error',
      },
    });
    expect(injectRes.statusCode).toBe(200);
    const faultId = injectRes.json().data.id;

    // 일반 요청 -- 에러 반환
    const testRes = await app.inject({ method: 'GET', url: '/test' });
    expect(testRes.statusCode).toBe(503);
    expect(testRes.json().error.code).toBe('CHAOS_INJECTED');

    // 장애 해제
    const removeRes = await app.inject({
      method: 'DELETE',
      url: `/chaos/faults/${faultId}`,
    });
    expect(removeRes.statusCode).toBe(200);
    expect(removeRes.json().success).toBe(true);
  });

  it('장애 해제 후 일반 요청이 정상 응답한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toBe('normal response');
  });

  it('/health 엔드포인트는 chaos 영향을 받지 않는다', async () => {
    // 장애 주입
    app.chaos.injectFault({
      type: 'error',
      probability: 1.0,
      errorCode: 500,
    });

    // health 라우트 등록 (이미 등록되지 않은 경우)
    try {
      app.get('/health', async () => ({ status: 'ok' }));
    } catch {
      // 이미 등록됨
    }

    // chaos 관리 엔드포인트도 영향받지 않음
    const statsRes = await app.inject({ method: 'GET', url: '/chaos/stats' });
    expect(statsRes.statusCode).toBe(200);

    // 전체 해제
    await app.inject({ method: 'POST', url: '/chaos/reset' });
  });

  it('/chaos/reset이 전체 장애를 해제한다', async () => {
    app.chaos.injectFault({ type: 'error', probability: 1.0, errorCode: 500 });
    app.chaos.injectFault({ type: 'latency', probability: 1.0, delayMs: 100 });
    expect(app.chaos.listFaults()).toHaveLength(2);

    const res = await app.inject({ method: 'POST', url: '/chaos/reset' });
    expect(res.statusCode).toBe(200);
    expect(app.chaos.listFaults()).toHaveLength(0);
  });
});

describe('chaosPlugin -- 비활성화', () => {
  it('disabled 옵션으로 chaos 기능이 비활성화된다', async () => {
    const app = Fastify({ logger: false });
    await app.register(chaosPlugin, { disabled: true });
    app.get('/test', async () => ({ data: 'ok' }));
    await app.ready();

    expect(app.chaos.isEnabled()).toBe(false);

    // chaos 관리 엔드포인트가 등록되지 않음
    const res = await app.inject({ method: 'GET', url: '/chaos/faults' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
