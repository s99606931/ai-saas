# SVC-AI-ADV-R94 — Adaptive Rate Limiter Design

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R94.plan.md

## 선택: EWMA + Token Bucket 하이브리드

## 인터페이스

```typescript
export interface RateRequest {
  tenantId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  timestamp?: number;
}

export type RateDecision = 'ALLOW' | 'THROTTLE' | 'DENY';

export interface AdaptiveOptions {
  baseRps: number;         // 기본 초당 허용량
  maxMultiplier: number;   // 최대 확장 배수 (예: 5)
  alpha: number;           // EWMA 계수 (0.0~1.0)
  windowMs: number;        // 관측 윈도우
}

export class AdaptiveRateLimiter {
  decide(req: RateRequest): RateDecision;
  record(req: RateRequest, allowed: boolean): void;
  snapshot(tenantId: string): TenantStats;
}
```

## 알고리즘

1. 테넌트별 TokenBucket + EWMA
2. EWMA_t = alpha * current + (1 - alpha) * EWMA_{t-1}
3. 동적 한도 = baseRps * min(maxMultiplier, max(1, EWMA / baseRps))
4. 우선순위 정책:
   - HIGH: 동적 한도의 100%
   - NORMAL: 80%
   - LOW: 50%
5. 초과 시: HIGH=THROTTLE, NORMAL/LOW=DENY

## 테스트

1. 기본 트래픽 ALLOW
2. 폭증 시 EWMA 상승 → 동적 한도 확대
3. LOW 우선순위 DENY
4. 테넌트 격리 (A 초과 시 B 영향 없음)
5. 메트릭 snapshot 정확도
