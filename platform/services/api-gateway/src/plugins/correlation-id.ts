// Correlation ID (X-Request-ID) 생성 및 전파 플러그인
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.9 (운영 관측성 보완)
// CSAP: D-06 감사 추적 — 분산 추적 식별자

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

const HEADER_NAME = 'x-request-id';

/**
 * Correlation ID 플러그인
 *
 * 1. 인바운드 요청에 X-Request-ID 헤더가 있으면 그대로 사용
 * 2. 없으면 UUIDv4 생성
 * 3. 응답 헤더에도 X-Request-ID 포함 (클라이언트 추적용)
 * 4. request.id에 바인딩 (pino 로그 자동 포함)
 */
async function correlationIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const incomingId = request.headers[HEADER_NAME];
    const correlationId = typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : randomUUID();

    // Fastify request.id에 바인딩 (pino 로그에 reqId로 자동 포함)
    (request as FastifyRequest & { id: string }).id = correlationId;

    // 하위 서비스 전파를 위해 요청 헤더에 주입
    const mutableHeaders = request.headers as Record<string, string | undefined>;
    mutableHeaders[HEADER_NAME] = correlationId;

    // 응답 헤더에도 포함 (클라이언트 추적용)
    void reply.header(HEADER_NAME, correlationId);
  });
}

export default fp(correlationIdPlugin, {
  name: 'correlation-id',
  fastify: '5.x',
});
