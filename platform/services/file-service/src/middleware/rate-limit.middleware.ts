// 파일 서비스 Rate Limiting 미들웨어
// Design Ref: SVC-FILE-R1 DESIGN
// Plan SC: FR-FILE.1
// CSAP: D-10 네트워크 보안 — 무차별 대입 공격 방어

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Redis 클라이언트 인터페이스 (최소 필요 메서드)
 */
interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/** Redis 클라이언트 싱글턴 */
let redisClient: RedisLike | null = null;
let redisInitAttempted = false;

/**
 * Redis 클라이언트 지연 초기화
 * Redis 미연결 시 null 반환 (가용성 우선 — rate limiting 비활성화)
 */
async function getRedis(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  if (redisInitAttempted) return null;

  redisInitAttempted = true;
  try {
    // 선택적 로딩: redis 패키지 미설치 시 graceful 실패
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule = require('redis') as {
      createClient: (config: { url: string }) => {
        connect: () => Promise<void>;
        incr: (key: string) => Promise<number>;
        expire: (key: string, seconds: number) => Promise<number>;
        ttl: (key: string) => Promise<number>;
      };
    };
    const client = redisModule.createClient({
      url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    });
    await client.connect();
    redisClient = client;
    return redisClient;
  } catch {
    // Redis 연결 실패 또는 패키지 미설치 시 rate limiting 비활성화
    return null;
  }
}

/**
 * Rate Limiting 미들웨어 팩토리
 *
 * Redis INCR + EXPIRE 기반 고정 윈도우 알고리즘.
 * CSAP D-08-06: 무차별 대입 공격 방어를 위한 요청 횟수 제한.
 *
 * @param maxRequests - 윈도우 내 최대 요청 수
 * @param windowSeconds - 시간 윈도우 (초)
 * @param keyPrefix - Redis 키 접두사
 * @returns Fastify preHandler 훅
 */
export function createRateLimiter(
  maxRequests: number,
  windowSeconds: number,
  keyPrefix: string = 'rl:file',
) {
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const redis = await getRedis();
    if (!redis) return; // Redis 미연결 시 통과 (가용성 우선)

    // 키: IP + 경로 접두사 (테넌트 격리는 라우트 레벨에서 처리)
    const clientIp = request.ip;
    const key = `${keyPrefix}:${clientIp}`;

    try {
      const current = await redis.incr(key);

      // 첫 번째 요청일 때 TTL 설정
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, maxRequests - current);

      // 응답 헤더 설정
      void reply.header('X-RateLimit-Limit', String(maxRequests));
      void reply.header('X-RateLimit-Remaining', String(remaining));
      void reply.header('X-RateLimit-Reset', String(ttl));

      if (current > maxRequests) {
        await reply.status(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
            retryAfter: ttl,
          },
        });
      }
    } catch {
      // Redis 오류 시 통과 (가용성 우선)
    }
  };
}
