// Rate Limiting 미들웨어 (@public-saas/rate-limit 공유 패키지 위임)
// Design Ref: SVC-AUTH-R1 DESIGN §3
// Plan SC: FR-AUTH.3
// CSAP: D-08-06 무차별 대입 공격 방어

import { createRateLimiter, setRedisClient } from '@public-saas/rate-limit';
import { redis } from '../lib/session.js';

// ioredis 인스턴스를 공유 패키지에 주입 (RedisLike 인터페이스 호환)
// ioredis의 incr/expire/ttl은 Promise<number>를 반환하므로 호환됨
setRedisClient(redis as Parameters<typeof setRedisClient>[0]);

interface RateLimitOptions {
  /** 윈도우 내 최대 허용 요청 수 */
  max: number;
  /** 윈도우 크기 (초) */
  windowSeconds: number;
  /** Redis 키 접두사 (기본: 'ratelimit') */
  keyPrefix?: string;
}

/**
 * Rate Limiting 미들웨어 생성 (공유 패키지 위임)
 *
 * @param options - Rate Limit 설정
 * @returns Fastify preHandler 함수
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  const { max, windowSeconds, keyPrefix = 'ratelimit' } = options;
  return createRateLimiter(max, windowSeconds, keyPrefix);
}
