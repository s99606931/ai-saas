# SVC-RATELIMIT-R27 DESIGN: Rate Limiter 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-RATELIMIT-R27.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 알고리즘: Sliding Window Counter

```
윈도우 크기: W (기본 60초)
최대 요청: M (기본 100)

현재 윈도우 카운트 = 현재 윈도우 요청 수 + (이전 윈도우 요청 수 * 이전 윈도우 잔여 비율)

예: W=60s, M=100
  이전 윈도우(0:00~1:00): 80건
  현재 윈도우(1:00~2:00): 30건, 현재 시각 1:15 (15/60 경과)
  가중 카운트 = 30 + 80 * (45/60) = 30 + 60 = 90 < 100 → 허용
```

이점: Fixed Window의 경계 시점 버스트 문제 해결, 메모리 효율적 (윈도우 2개만 저장)

---

## 키 기반 테넌트 분리

```typescript
// 키 생성 전략
type KeyExtractor = (req: Request) => string;

// 기본 키: 테넌트 ID (헤더에서 추출)
const defaultKeyExtractor = (req) => req.headers['x-tenant-id'] || req.ip;

// 각 키별 독립 윈도우 관리
Map<string, { currentCount: number, previousCount: number, windowStart: number }>
```

---

## 응답 형식

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1713400000
Retry-After: 45
Content-Type: application/json

{"error":"Rate limit exceeded","retryAfter":45}
```

허용 시 헤더:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 72
X-RateLimit-Reset: 1713400000
```

---

## 주요 인터페이스

```typescript
interface RateLimiterOptions {
  windowMs: number;        // 윈도우 크기 (밀리초, 기본: 60000)
  maxRequests: number;     // 윈도우당 최대 요청 (기본: 100)
  keyExtractor?: (identifier: string) => string;  // 키 추출 함수
}

interface RateLimitResult {
  allowed: boolean;        // 허용 여부
  limit: number;           // 최대 허용 수
  remaining: number;       // 잔여 허용 수
  resetAt: number;         // 윈도우 리셋 타임스탬프 (ms)
  retryAfter?: number;     // 재시도 대기 시간 (초, 거부 시만)
}
```

---

## Session Guide

### 구현 순서
1. `src/rate-limiter.ts` -- 코어 Rate Limiter (Sliding Window Counter)
2. `src/rate-limit-plugin.ts` -- Fastify 플러그인
3. `src/index.ts` -- 패키지 엔트리포인트
4. `tests/rate-limiter.test.ts` -- 단위 테스트
5. `tests/rate-limit-plugin.test.ts` -- 플러그인 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-RATELIMIT-R27 DESIGN`
- 모든 함수: `// Plan SC: FR-RL.{번호}`
