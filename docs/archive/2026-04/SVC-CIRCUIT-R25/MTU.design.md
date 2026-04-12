# SVC-CIRCUIT-R25 DESIGN: 서킷 브레이커 + 재시도 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-CIRCUIT-R25.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. opossum 라이브러리 | npm opossum 사용 | 검증된 구현 | 외부 의존성 |
| **B. 순수 TypeScript** | 자체 구현 | 무의존, 경량, CSAP 감사 통합 용이 | 자체 유지보수 |
| C. Linkerd 서비스 메시 | 인프라 레벨 서킷 브레이커 | 애플리케이션 무변경 | 인프라 복잡도 |

**선택: 옵션 B (Pragmatic Balance)** -- 외부 의존성 최소화, 공공기관 감사 요건 통합

---

## 1. 서킷 브레이커 (circuit-breaker.ts)

### 상태 전이 다이어그램
```
CLOSED --[실패율 >= threshold]--> OPEN
OPEN --[resetTimeout 경과]--> HALF_OPEN
HALF_OPEN --[프로브 성공]--> CLOSED
HALF_OPEN --[프로브 실패]--> OPEN
```

### 설계 파라미터
```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;    // 실패율 임계값 (기본: 0.5 = 50%)
  minimumCalls: number;        // 최소 호출 수 (기본: 5)
  resetTimeoutMs: number;      // OPEN->HALF_OPEN 전환 시간 (기본: 30000ms)
  halfOpenMaxCalls: number;    // HALF_OPEN 상태 프로브 호출 수 (기본: 3)
  windowSizeMs: number;        // 실패율 계산 윈도우 (기본: 60000ms)
  fallback?: (error: Error) => unknown; // 폴백 함수
}
```

### 슬라이딩 윈도우 실패율 계산
- 최근 windowSizeMs 내의 호출만 집계
- 오래된 호출 자동 제거 (ring buffer)
- failureRate = failures / totalCalls

---

## 2. 재시도 (retry.ts)

### 지수 백오프 전략
```
delay(attempt) = baseDelay * 2^(attempt-1) + random_jitter
jitter = random(0, baseDelay * 0.1)
```

### 설계 파라미터
```typescript
interface RetryOptions {
  maxRetries: number;          // 최대 재시도 횟수 (기본: 3)
  baseDelayMs: number;         // 기본 대기 시간 (기본: 1000ms)
  maxDelayMs: number;          // 최대 대기 시간 (기본: 30000ms)
  jitterEnabled: boolean;      // 지터 활성화 (기본: true)
  retryableErrors?: (error: Error) => boolean; // 재시도 대상 에러 판별
}
```

---

## 3. 모니터링 메트릭

```typescript
interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  failureRate: number;
  stateTransitions: number;
  lastStateChange: string;
}
```

---

## Session Guide

### 구현 순서
1. `src/circuit-breaker.ts` -- 3-상태 서킷 브레이커
2. `src/retry.ts` -- 지수 백오프 재시도
3. `src/index.ts` -- 패키지 엔트리포인트
4. `tests/circuit-breaker.test.ts` -- 서킷 브레이커 단위 테스트
5. `tests/retry.test.ts` -- 재시도 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-CIRCUIT-R25 DESIGN`
- 모든 함수: `// Plan SC: FR-CB.{번호}`
