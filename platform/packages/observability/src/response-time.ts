// X-Response-Time 미들웨어 (Fastify 플러그인)
// Design Ref: SVC-OTEL-R3 DESIGN Section 4
// Plan SC: FR-OTEL.2
// CSAP: D-10 네트워크 보안 -- 응답 시간 모니터링 (DoS 탐지 보조)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * 요청 시작 시간 저장용 심볼 (요청 객체 오염 방지)
 */
const START_TIME = Symbol('responseTimeStart');

/**
 * X-Response-Time 플러그인
 *
 * 모든 응답에 X-Response-Time 헤더를 추가합니다 (밀리초 단위).
 * 성능 모니터링 및 CSAP D-10 DoS 탐지 보조에 활용합니다.
 *
 * @example
 * ```typescript
 * import { responseTimePlugin } from '@public-saas/observability';
 * await app.register(responseTimePlugin);
 * ```
 */
async function responseTimePluginFn(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as unknown as Record<symbol, bigint>)[START_TIME] = process.hrtime.bigint();
  });

  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = (request as unknown as Record<symbol, bigint>)[START_TIME];
    if (start !== undefined) {
      const elapsed = process.hrtime.bigint() - start;
      const ms = Number(elapsed) / 1_000_000;
      void reply.header('X-Response-Time', `${ms.toFixed(2)}ms`);
    }
  });
}

export const responseTimePlugin = fp(responseTimePluginFn, {
  name: 'response-time',
  fastify: '5.x',
});
