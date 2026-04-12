# Design: L-01 -- Rate Limit 미들웨어 공유 패키지화

> 작성일: 2026-04-10 | 버전: 1.0

## 1. 패키지 구조

```
platform/packages/rate-limit/
  package.json          # @public-saas/rate-limit
  tsconfig.json
  src/
    index.ts            # createRateLimiter + RedisLike export
```

## 2. API 설계

```typescript
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export function createRateLimiter(
  maxRequests: number,
  windowSeconds: number,
  keyPrefix?: string,
): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
```

## 3. Redis 클라이언트 전략
- 패키지 내부에 Redis 지연 초기화 로직 포함
- 환경변수 REDIS_URL 기반 자동 연결
- Redis 미연결 시 graceful 통과 (가용성 우선)

## 4. 마이그레이션 전략
- 각 서비스의 middleware/ 디렉토리 삭제
- routes.ts import를 `@public-saas/rate-limit`으로 변경
- 기존 createRateLimiter 호출 시그니처 동일 → 변경 최소화
