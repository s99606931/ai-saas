// 메뉴 서비스 Rate Limiting 미들웨어
// Design Ref: SVC-MENU-R1 DESIGN
// Plan SC: FR-MENU.1
// CSAP: D-10 네트워크 보안 — 무차별 대입 공격 방어

import type { FastifyRequest, FastifyReply } from 'fastify';

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

let redisClient: RedisLike | null = null;
let redisInitAttempted = false;

async function getRedis(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  if (redisInitAttempted) return null;
  redisInitAttempted = true;
  try {
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
    return null;
  }
}

export function createRateLimiter(
  maxRequests: number,
  windowSeconds: number,
  keyPrefix: string = 'rl:menu',
) {
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const redis = await getRedis();
    if (!redis) return;
    const clientIp = request.ip;
    const key = `${keyPrefix}:${clientIp}`;
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, maxRequests - current);
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
