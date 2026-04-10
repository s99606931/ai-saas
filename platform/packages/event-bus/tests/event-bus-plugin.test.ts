// eventBusPlugin 통합 테스트
// Design Ref: SVC-EVENT-R17 Plan
// Plan SC: FR-EVT.1

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { eventBusPlugin } from '../src/event-bus-plugin.js';

describe('eventBusPlugin -- Fastify 통합', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(eventBusPlugin, {
      maxRetries: 1,
      retryBaseDelay: 10,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('events decorator가 등록된다', () => {
    expect(app.events).toBeDefined();
    expect(typeof app.events.on).toBe('function');
    expect(typeof app.events.emit).toBe('function');
  });

  it('/events/stats 엔드포인트가 통계를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/stats' });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.published).toBe(0);
  });

  it('/events/dead-letters 엔드포인트가 데드레터 큐를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/events/dead-letters' });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.count).toBe(0);
    expect(res.json().data.items).toEqual([]);
  });

  it('이벤트 발행/구독이 Fastify 내에서 동작한다', async () => {
    let received = false;
    app.events.on('test.event', () => { received = true; });

    await app.events.emit('test.event', { data: 'hello' });

    expect(received).toBe(true);
  });

  it('DELETE /events/dead-letters가 큐를 비운다', async () => {
    // 실패 이벤트 발생
    app.events.on('fail-event', () => { throw new Error('test'); });
    await app.events.emit('fail-event', null);

    expect(app.events.getDeadLetterCount()).toBeGreaterThan(0);

    const res = await app.inject({ method: 'DELETE', url: '/events/dead-letters' });
    expect(res.statusCode).toBe(200);
    expect(app.events.getDeadLetterCount()).toBe(0);
  });
});

describe('eventBusPlugin -- 엔드포인트 비활성화', () => {
  it('exposeStats=false 시 통계 엔드포인트가 없다', async () => {
    const app = Fastify({ logger: false });
    await app.register(eventBusPlugin, {
      exposeStats: false,
      exposeDeadLetters: false,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/events/stats' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
