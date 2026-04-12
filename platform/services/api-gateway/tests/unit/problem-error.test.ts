// 전역 Problem Details 에러 핸들러 유닛 테스트
// Design Ref: SVC-APIGWR2-R51.design.md §2, §3
// Plan SC: FR-APIGWR2.1, FR-APIGWR2.2, FR-APIGWR2.5, FR-APIGWR2.6

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import problemErrorPlugin, {
  buildProblemFromError,
  extractGatewayTraceId,
  GATEWAY_ERROR_BASE,
} from '../../src/plugins/problem-error.js';

async function makeApp() {
  const app = Fastify({ logger: false });
  await app.register(problemErrorPlugin);
  return app;
}

describe('buildProblemFromError (FR-APIGWR2.1)', () => {
  it('5xx 상태 에러는 internal-error 프리셋을 사용한다', () => {
    const err = Object.assign(new Error('db down'), { statusCode: 500 });
    const pd = buildProblemFromError(err);
    expect(pd.status).toBe(500);
    expect(pd.type).toContain('internal-error');
  });

  it('상태코드가 없으면 500으로 기본 처리한다', () => {
    const err = new Error('nope');
    const pd = buildProblemFromError(err);
    expect(pd.status).toBe(500);
  });

  it('4xx 에러는 gateway/client-error type을 사용한다', () => {
    const err = Object.assign(new Error('bad input'), { statusCode: 400 });
    const pd = buildProblemFromError(err);
    expect(pd.status).toBe(400);
    expect(pd.type).toBe(`${GATEWAY_ERROR_BASE}/client-error`);
    expect(pd.detail).toBe('bad input');
  });

  it('유효 범위 밖 상태코드(<400)는 500으로 치환된다', () => {
    const err = Object.assign(new Error('weird'), { statusCode: 200 });
    const pd = buildProblemFromError(err);
    expect(pd.status).toBe(500);
  });
});

describe('extractGatewayTraceId (FR-APIGWR2.5)', () => {
  it('x-request-id 헤더를 우선 사용한다', async () => {
    const fakeReq = {
      headers: { 'x-request-id': 'abc-123' },
      id: 'fastify-id',
    } as unknown as Parameters<typeof extractGatewayTraceId>[0];
    expect(extractGatewayTraceId(fakeReq)).toBe('abc-123');
  });

  it('헤더가 없으면 request.id를 fallback으로 사용한다', async () => {
    const fakeReq = {
      headers: {},
      id: 'fastify-id-456',
    } as unknown as Parameters<typeof extractGatewayTraceId>[0];
    expect(extractGatewayTraceId(fakeReq)).toBe('fastify-id-456');
  });

  it('둘 다 없으면 undefined를 반환한다', () => {
    const fakeReq = { headers: {} } as unknown as Parameters<typeof extractGatewayTraceId>[0];
    expect(extractGatewayTraceId(fakeReq)).toBeUndefined();
  });
});

describe('problemErrorPlugin: setErrorHandler (FR-APIGWR2.1)', () => {
  it('throw한 500 에러를 application/problem+json으로 변환한다', async () => {
    const app = await makeApp();
    app.get('/boom', async () => {
      throw new Error('internal boom');
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    const body = JSON.parse(res.body);
    expect(body.status).toBe(500);
    expect(body.type).toContain('internal-error');
    await app.close();
  });

  it('statusCode가 400인 에러를 Problem Details로 변환한다', async () => {
    const app = await makeApp();
    app.get('/bad', async () => {
      const err = Object.assign(new Error('invalid request'), { statusCode: 400 });
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/bad' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.status).toBe(400);
    expect(body.detail).toBe('invalid request');
    expect(body.type).toBe(`${GATEWAY_ERROR_BASE}/client-error`);
    await app.close();
  });

  it('x-request-id가 제공되면 traceId를 응답 본문에 포함한다', async () => {
    const app = await makeApp();
    app.get('/boom', async () => {
      throw new Error('boom');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'trace-xyz' },
    });
    const body = JSON.parse(res.body);
    expect(body.traceId).toBe('trace-xyz');
    await app.close();
  });
});

describe('problemErrorPlugin: setNotFoundHandler (FR-APIGWR2.2)', () => {
  it('등록되지 않은 경로에 404 Problem Details를 반환한다', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    const body = JSON.parse(res.body);
    expect(body.status).toBe(404);
    expect(body.detail).toContain('/does-not-exist');
    await app.close();
  });

  it('404 응답에도 traceId가 주입된다', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/missing',
      headers: { 'x-request-id': 'trace-404' },
    });
    const body = JSON.parse(res.body);
    expect(body.traceId).toBe('trace-404');
    await app.close();
  });
});
