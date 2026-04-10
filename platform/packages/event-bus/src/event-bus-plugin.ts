// 이벤트 버스 Fastify 플러그인
// Design Ref: SVC-EVENT-R17 Plan
// Plan SC: FR-EVT.1
// CSAP: D-06 침해사고 관리

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { EventBus, type EventBusOptions } from './event-bus.js';

/**
 * 이벤트 버스 플러그인 옵션
 */
export interface EventBusPluginOptions extends FastifyPluginOptions, EventBusOptions {
  /** /events/stats 엔드포인트 등록 (기본: true) */
  exposeStats?: boolean;
  /** /events/dead-letters 엔드포인트 등록 (기본: true) */
  exposeDeadLetters?: boolean;
}

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    events: EventBus;
  }
}

/**
 * eventBusPlugin -- 이벤트 버스 Fastify 플러그인
 */
async function eventBusPluginImpl(
  app: FastifyInstance,
  opts: EventBusPluginOptions,
): Promise<void> {
  const bus = new EventBus({
    maxRetries: opts.maxRetries,
    retryBaseDelay: opts.retryBaseDelay,
    maxDeadLetters: opts.maxDeadLetters,
  });

  app.decorate('events', bus);

  // 이벤트 통계 엔드포인트
  if (opts.exposeStats !== false) {
    app.get('/events/stats', async () => ({
      success: true,
      data: bus.getStats(),
    }));
  }

  // 데드레터 큐 엔드포인트
  if (opts.exposeDeadLetters !== false) {
    app.get('/events/dead-letters', async () => ({
      success: true,
      data: {
        count: bus.getDeadLetterCount(),
        items: bus.getDeadLetters(),
      },
    }));

    app.delete('/events/dead-letters', async () => {
      bus.clearDeadLetters();
      return { success: true, message: '데드레터 큐 비움' };
    });
  }

  // 서버 종료 시 리스너 정리
  app.addHook('onClose', async () => {
    bus.removeAllListeners();
  });
}

export const eventBusPlugin = fp(eventBusPluginImpl, {
  name: '@public-saas/event-bus',
  fastify: '5.x',
});
