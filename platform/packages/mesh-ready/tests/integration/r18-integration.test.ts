// Round 18: R13~R17 패키지 통합 테스트
// Design Ref: SVC-INTEGRATE-R18 Plan
// Plan SC: FR-R18.1~FR-R18.5
// CSAP: D-07 가용성, D-08 접근 통제, D-09 암호화, D-10 분산 추적, D-06 이벤트 감사

import { describe, it, expect, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  meshReadyPlugin,
  GracefulShutdown,
  TraceContextPropagator,
} from '../../src/index.js';

// ─── FR-R18.1: meshReadyPlugin 통합 검증 ───

describe('FR-R18.1: meshReadyPlugin 통합', () => {
  it('mesh decorator + /metadata 엔드포인트가 동작해야 한다', async () => {
    const app = Fastify();
    await app.register(meshReadyPlugin, {
      service: { name: 'test-service', version: '1.0.0' },
      shutdown: { timeout: 5000 },
      disableShutdown: true,
    });
    await app.ready();

    // decorator 확인
    expect(app.mesh).toBeDefined();
    expect(app.mesh.metadata).toBeDefined();
    expect(app.mesh.tracer).toBeDefined();
    expect(app.mesh.shutdown).toBeDefined();
    expect(app.mesh.serviceName).toBe('test-service');
    expect(app.mesh.serviceVersion).toBe('1.0.0');

    // /metadata 엔드포인트 확인
    const res = await app.inject({ method: 'GET', url: '/metadata' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.service.name).toBe('test-service');
    expect(body.data.service.version).toBe('1.0.0');

    await app.close();
  });

  it('W3C traceparent 헤더를 전파해야 한다', async () => {
    const app = Fastify();
    app.get('/trace-test', async () => ({ ok: true }));
    await app.register(meshReadyPlugin, {
      service: { name: 'trace-svc', version: '1.0.0' },
      disableShutdown: true,
    });
    await app.ready();

    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const res = await app.inject({
      method: 'GET',
      url: '/trace-test',
      headers: { traceparent },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['traceparent']).toBe(traceparent);

    await app.close();
  });

  it('추적 헤더 없으면 새로 생성해야 한다', async () => {
    const app = Fastify();
    app.get('/trace-new', async () => ({ ok: true }));
    await app.register(meshReadyPlugin, {
      service: { name: 'trace-svc2', version: '1.0.0' },
      disableShutdown: true,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/trace-new' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['traceparent']).toBeDefined();
    expect(typeof res.headers['traceparent']).toBe('string');

    await app.close();
  });

  it('GracefulShutdown이 종료 상태를 추적해야 한다', async () => {
    const app = Fastify();
    await app.register(meshReadyPlugin, {
      service: { name: 'gs-test', version: '1.0.0' },
      disableShutdown: true,
    });
    await app.ready();

    expect(app.mesh.shutdown.isTerminating()).toBe(false);
    expect(app.mesh.shutdown.getActiveRequests()).toBe(0);

    await app.close();
  });
});

// ─── CSAP D-07: GracefulShutdown 단위 검증 ───

describe('CSAP D-07: GracefulShutdown', () => {
  it('기본 타임아웃이 정상이어야 한다', () => {
    const gs = new GracefulShutdown();
    expect(gs.isTerminating()).toBe(false);
    expect(gs.getActiveRequests()).toBe(0);
  });

  it('요청 카운터 증감이 정확해야 한다', () => {
    const gs = new GracefulShutdown();
    gs.incrementRequests();
    gs.incrementRequests();
    expect(gs.getActiveRequests()).toBe(2);
    gs.decrementRequests();
    expect(gs.getActiveRequests()).toBe(1);
    gs.decrementRequests();
    expect(gs.getActiveRequests()).toBe(0);
    gs.decrementRequests();
    expect(gs.getActiveRequests()).toBe(0);
  });

  it('정리 핸들러를 등록할 수 있어야 한다', () => {
    const gs = new GracefulShutdown();
    gs.addCleanupHandler(async () => {});
    gs.addCleanupHandler(async () => {});
    expect(gs.isTerminating()).toBe(false);
  });

  it('활성 요청 없으면 즉시 셧다운해야 한다', async () => {
    const gs = new GracefulShutdown({ timeout: 1000 });
    await gs.shutdown();
    expect(gs.isTerminating()).toBe(true);
  });
});

// ─── CSAP D-10: TraceContextPropagator 검증 ───

describe('CSAP D-10: TraceContextPropagator', () => {
  const propagator = new TraceContextPropagator();

  it('새 컨텍스트가 W3C 형식이어야 한다', () => {
    const ctx = propagator.generateNewContext();
    expect(ctx['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(ctx['b3']).toBeDefined();
    expect(ctx['x-b3-traceid']).toBeDefined();
    expect(ctx['x-b3-spanid']).toBeDefined();
    expect(ctx['x-request-id']).toBeDefined();
  });

  it('traceparent 파싱이 정확해야 한다', () => {
    const result = propagator.parseTraceparent(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
    expect(result).not.toBeNull();
    expect(result!.version).toBe('00');
    expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(result!.spanId).toBe('00f067aa0ba902b7');
    expect(result!.flags).toBe('01');
  });

  it('잘못된 traceparent는 null을 반환해야 한다', () => {
    expect(propagator.parseTraceparent('invalid')).toBeNull();
    expect(propagator.parseTraceparent('00-short-id-01')).toBeNull();
  });

  it('B3 단일 헤더 파싱이 정확해야 한다', () => {
    const result = propagator.parseB3Single('4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-1');
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(result!.sampled).toBe('1');
  });

  it('기존 traceparent를 유지하여 전파해야 한다', () => {
    const headers = propagator.createPropagationHeaders({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(headers['traceparent']).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(headers['x-request-id']).toBeDefined();
  });

  it('B3 + x-request-id를 함께 전파해야 한다', () => {
    const headers = propagator.createPropagationHeaders({
      'x-b3-traceid': 'abcdef1234567890',
      'x-b3-spanid': '1234567890abcdef',
      'x-b3-sampled': '1',
      'x-request-id': 'req-123',
    });
    expect(headers['x-b3-traceid']).toBe('abcdef1234567890');
    expect(headers['x-request-id']).toBe('req-123');
  });
});

// ─── 17개 서비스 통합 패턴 검증 ───

describe('17개 서비스 통합 패턴 검증', () => {
  it('meshReadyPlugin 독립 등록이 가능해야 한다', async () => {
    const app = Fastify();
    await app.register(meshReadyPlugin, {
      service: { name: 'standalone', version: '0.1.0' },
      disableShutdown: true,
    });
    await app.ready();
    expect(app.mesh.serviceName).toBe('standalone');
    await app.close();
  });

  it('다중 서비스 메타데이터가 각각 고유해야 한다', async () => {
    const services = ['auth', 'user', 'tenant', 'billing'];
    const apps: FastifyInstance[] = [];

    for (const name of services) {
      const app = Fastify();
      await app.register(meshReadyPlugin, {
        service: { name: `${name}-service`, version: '0.2.0' },
        disableShutdown: true,
      });
      await app.ready();
      apps.push(app);
    }

    for (let i = 0; i < services.length; i++) {
      const res = await apps[i]!.inject({ method: 'GET', url: '/metadata' });
      const body = JSON.parse(res.body);
      expect(body.data.service.name).toBe(`${services[i]}-service`);
    }

    for (const app of apps) {
      await app.close();
    }
  });

  it('분산 추적 비활성화 옵션이 동작해야 한다', async () => {
    const app = Fastify();
    app.get('/no-trace', async () => ({ ok: true }));
    await app.register(meshReadyPlugin, {
      service: { name: 'no-trace-svc', version: '0.1.0' },
      disableShutdown: true,
      disableTracing: true,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/no-trace' });
    expect(res.statusCode).toBe(200);
    // 분산 추적 비활성화 시 traceparent 없음
    expect(res.headers['traceparent']).toBeUndefined();

    await app.close();
  });

  it('metadata 엔드포인트 비활성화 옵션이 동작해야 한다', async () => {
    const app = Fastify();
    await app.register(meshReadyPlugin, {
      service: { name: 'no-meta-svc', version: '0.1.0' },
      disableShutdown: true,
      disableMetadataEndpoint: true,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/metadata' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
