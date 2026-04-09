// Rate Limiting 미들웨어 (Redis 기반)
// Design Ref: SVC-AUTH-R1 DESIGN §3
// Plan SC: FR-AUTH.3
// CSAP: D-08-06 무차별 대입 공격 방어

import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../lib/session.js';

interface RateLimitOptions {
  /** 윈도우 내 최대 허용 요청 수 (기본: 10) */
  max: number;
  /** 윈도우 크기 (초, 기본: 60) */
  windowSeconds: number;
  /** Redis 키 접두사 (기본: 'ratelimit') */
  keyPrefix?: string;
}

/**
 * Rate Limiting 미들웨어 생성
 *
 * Redis INCR + EXPIRE 기반 고정 윈도우 알고리즘.
 * CSAP D-08-06: 무차별 대입 공격 방어를 위한 요청 횟수 제한.
 *
 * @param options - Rate Limit 설정
 * @returns Fastify preHandler 함수
 *
 * @example
 * ```typescript
 * app.post('/auth/login', {
 *   preHandler: rateLimitMiddleware({ max: 10, windowSeconds: 60 }),
 * }, loginHandler);
 * ```
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  const {
    max,
    windowSeconds,
    keyPrefix = 'ratelimit',
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ip = request.ip;
    const urlPath = request.url.split('?')[0] ?? request.url;
    const key = `${keyPrefix}:${ip}:${urlPath}`;

    // Redis INCR: 키가 없으면 1로 생성, 있으면 증가
    const current = await redis.incr(key);

    // 첫 요청 시 TTL 설정
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    // TTL 조회 (Retry-After 계산용)
    const ttl = await redis.ttl(key);
    const resetTimestamp = Math.floor(Date.now() / 1000) + Math.max(ttl, 0);

    // Rate Limit 헤더 설정
    void reply.header('X-RateLimit-Limit', String(max));
    void reply.header('X-RateLimit-Remaining', String(Math.max(0, max - current)));
    void reply.header('X-RateLimit-Reset', String(resetTimestamp));

    if (current > max) {
      void reply.header('Retry-After', String(Math.max(ttl, 1)));
      await reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '요청 횟수를 초과했습니다. 잠시 후 다시 시도하세요',
          retryAfter: Math.max(ttl, 1),
        },
      });
      return;
    }
  };
}
