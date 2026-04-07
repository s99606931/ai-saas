// Correlation ID (X-Request-ID) 플러그인 단위 테스트
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.9 (운영 관측성 보완)
// CSAP: D-06 감사 추적 — 분산 추적 식별자

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import correlationIdPlugin from '../../src/plugins/correlation-id.js';

describe('correlation-id 플러그인', () => {
  it('TC-CID-01: X-Request-ID 헤더가 없으면 UUIDv4를 자동 생성한다', async () => {
    const app = Fastify();
    await app.register(correlationIdPlugin);
    app.get('/test', async (request, reply) => {
      return { requestId: request.id };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    const body = JSON.parse(response.body);
    // UUID v4 형식 검증 (8-4-4-4-12)
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    // 응답 헤더에도 동일한 ID가 포함된다
    expect(response.headers['x-request-id']).toBe(body.requestId);
  });

  it('TC-CID-02: 클라이언트가 보낸 X-Request-ID가 그대로 전파된다', async () => {
    const app = Fastify();
    await app.register(correlationIdPlugin);
    app.get('/test', async (request) => {
      return { requestId: request.id };
    });

    const clientId = 'client-trace-abc-123';
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': clientId },
    });

    const body = JSON.parse(response.body);
    expect(body.requestId).toBe(clientId);
    expect(response.headers['x-request-id']).toBe(clientId);
  });

  it('TC-CID-03: 빈 문자열 X-Request-ID는 무시하고 새 UUID를 생성한다', async () => {
    const app = Fastify();
    await app.register(correlationIdPlugin);
    app.get('/test', async (request) => {
      return { requestId: request.id };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': '' },
    });

    const body = JSON.parse(response.body);
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('TC-CID-04: 연속 요청마다 서로 다른 Correlation ID가 생성된다', async () => {
    const app = Fastify();
    await app.register(correlationIdPlugin);
    app.get('/test', async (request) => {
      return { requestId: request.id };
    });

    const response1 = await app.inject({ method: 'GET', url: '/test' });
    const response2 = await app.inject({ method: 'GET', url: '/test' });

    const id1 = JSON.parse(response1.body).requestId;
    const id2 = JSON.parse(response2.body).requestId;
    expect(id1).not.toBe(id2);
  });

  it('TC-CID-05: POST 요청에서도 Correlation ID가 정상 동작한다', async () => {
    const app = Fastify();
    await app.register(correlationIdPlugin);
    app.post('/test', async (request) => {
      return { requestId: request.id };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: { data: 'test' },
    });

    const body = JSON.parse(response.body);
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.headers['x-request-id']).toBe(body.requestId);
  });
});
