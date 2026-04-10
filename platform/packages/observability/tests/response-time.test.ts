// X-Response-Time 미들웨어 테스트
// Design Ref: SVC-OTEL-R3 DESIGN Section 4
// Plan SC: FR-OTEL.2, FR-OTEL.4
// CSAP: D-10 응답 시간 모니터링

import { describe, it, expect, afterAll } from 'vitest';
import Fastify from 'fastify';
import { responseTimePlugin } from '../src/response-time.js';

describe('responseTimePlugin', () => {
  // 모든 라우트를 미리 등록한 후 inject 사용
  const app = Fastify();

  // 플러그인 등록 + 라우트 미리 등록
  app.register(responseTimePlugin);
  app.get('/test-rt', async () => ({ ok: true }));
  app.get('/test-rt-positive', async () => ({ ok: true }));
  app.post('/test-rt-post', async () => ({ created: true }));
  app.get('/test-rt-fast', async () => ({ fast: true }));

  afterAll(async () => {
    await app.close();
  });

  it('플러그인 등록 후 서버가 정상 기동한다', async () => {
    await app.ready();
    expect(app).toBeDefined();
  });

  it('GET 응답에 X-Response-Time 헤더가 포함된다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-rt',
    });

    expect(response.statusCode).toBe(200);
    const rtHeader = response.headers['x-response-time'];
    expect(rtHeader).toBeDefined();
    expect(typeof rtHeader).toBe('string');
    expect(rtHeader).toMatch(/^\d+\.\d+ms$/);
  });

  it('X-Response-Time 값이 양수이다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-rt-positive',
    });

    const rtHeader = response.headers['x-response-time'] as string;
    const ms = parseFloat(rtHeader.replace('ms', ''));
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('POST 요청에도 X-Response-Time이 포함된다', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test-rt-post',
      payload: { data: 'test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-response-time']).toBeDefined();
  });

  it('404 응답에도 X-Response-Time이 포함된다', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent-route-12345',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-response-time']).toBeDefined();
  });

  it('처리 시간이 합리적인 범위 내이다 (< 1000ms)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-rt-fast',
    });

    const rtHeader = response.headers['x-response-time'] as string;
    const ms = parseFloat(rtHeader.replace('ms', ''));
    expect(ms).toBeLessThan(1000);
  });
});
