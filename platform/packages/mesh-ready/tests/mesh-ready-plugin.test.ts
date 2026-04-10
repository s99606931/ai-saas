// meshReadyPlugin 통합 테스트
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.1, FR-MESH.2, FR-MESH.4

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { meshReadyPlugin } from '../src/mesh-ready-plugin.js';

describe('meshReadyPlugin -- Fastify 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(meshReadyPlugin, {
      service: {
        name: 'test-service',
        version: '1.0.0',
        namespace: 'test-ns',
        protocols: ['http', 'grpc'],
        dependencies: ['db', 'redis'],
      },
      disableShutdown: true, // 테스트에서 SIGTERM 핸들러 등록 방지
    });

    app.get('/test', async () => ({ data: 'hello' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('mesh decorator가 등록된다', () => {
    expect(app.mesh).toBeDefined();
    expect(app.mesh.metadata).toBeDefined();
    expect(app.mesh.tracer).toBeDefined();
    expect(app.mesh.shutdown).toBeDefined();
    expect(app.mesh.serviceName).toBe('test-service');
    expect(app.mesh.serviceVersion).toBe('1.0.0');
  });

  it('/metadata 엔드포인트가 서비스 정보를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/metadata' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.service.name).toBe('test-service');
    expect(body.data.service.version).toBe('1.0.0');
    expect(body.data.service.namespace).toBe('test-ns');
    expect(body.data.service.protocols).toEqual(['http', 'grpc']);
    expect(body.data.service.dependencies).toEqual(['db', 'redis']);
    expect(body.data.runtime.nodeVersion).toBe(process.version);
    expect(body.data.runtime.pid).toBe(process.pid);
  });

  it('요청 시 추적 헤더가 응답에 포함된다 (새 컨텍스트 생성)', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);

    // 새 추적 컨텍스트가 생성되어 응답 헤더에 포함
    expect(res.headers['traceparent']).toBeDefined();
    expect(res.headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(res.headers['b3']).toBeDefined();
    expect(res.headers['x-b3-traceid']).toBeDefined();
    expect(res.headers['x-b3-spanid']).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('수신 traceparent 헤더를 전파한다', async () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c';
    const spanId = 'b7ad6b7169203331';
    const traceparent = `00-${traceId}-${spanId}-01`;

    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { traceparent },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['traceparent']).toBe(traceparent);
  });

  it('수신 B3 헤더를 전파한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-b3-traceid': '80f198ee56343ba864fe8b2a57d3eff7',
        'x-b3-spanid': 'e457b5a2e4d86bd1',
        'x-b3-sampled': '1',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-b3-traceid']).toBe('80f198ee56343ba864fe8b2a57d3eff7');
    expect(res.headers['x-b3-spanid']).toBe('e457b5a2e4d86bd1');
    expect(res.headers['x-b3-sampled']).toBe('1');
  });

  it('x-request-id를 전파한다', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-request-id': 'custom-req-id-12345',
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe('custom-req-id-12345');
  });
});

describe('meshReadyPlugin -- 옵션 비활성화', () => {
  it('disableTracing 옵션으로 추적 헤더 전파를 비활성화한다', async () => {
    const app = Fastify({ logger: false });
    await app.register(meshReadyPlugin, {
      service: { name: 'no-trace', version: '1.0.0' },
      disableTracing: true,
      disableShutdown: true,
    });
    app.get('/test', async () => ({ data: 'ok' }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    // 추적 헤더가 없어야 함
    expect(res.headers['traceparent']).toBeUndefined();

    await app.close();
  });

  it('disableMetadataEndpoint 옵션으로 /metadata를 비활성화한다', async () => {
    const app = Fastify({ logger: false });
    await app.register(meshReadyPlugin, {
      service: { name: 'no-metadata', version: '1.0.0' },
      disableMetadataEndpoint: true,
      disableShutdown: true,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/metadata' });

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
