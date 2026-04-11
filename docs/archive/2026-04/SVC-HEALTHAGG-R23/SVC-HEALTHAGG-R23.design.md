# SVC-HEALTHAGG-R23 DESIGN: 다중 서비스 헬스체크 집계기

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-HEALTHAGG-R23.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 외부 서비스 모니터링 | Prometheus + AlertManager 직접 연동 | 표준 관측성 | 외부 의존성, 복잡도 |
| **B. 인메모리 집계기** | TypeScript 클래스 + Fastify 플러그인 | 무의존, 즉시 사용, 테스트 용이 | 분산 환경 한계 |
| C. Redis 기반 집계 | Redis에 상태 저장 | 분산 환경 지원 | Redis 의존성 추가 |

**선택: 옵션 B (Pragmatic Balance)** -- 외부 서비스 최소화, 단일 인스턴스 환경 최적화

---

## 1. 핵심 클래스: HealthAggregator

### 설계 원칙
- 서비스 등록/해제 패턴 (Registry)
- 비동기 헬스체크 함수 주입 (Strategy Pattern)
- 타임아웃 보호 (Promise.race 패턴)
- 이력 추적 (Ring Buffer 방식, maxHistorySize 제한)

### 상태 판정 규칙
```
모든 서비스 healthy → 종합 healthy
critical 서비스 unhealthy → 종합 unhealthy
non-critical unhealthy → 종합 degraded
응답 > degradedThresholdMs → 해당 서비스 degraded
```

### 주요 인터페이스
```typescript
HealthStatus = 'healthy' | 'degraded' | 'unhealthy'
HealthChecker = () => Promise<HealthCheckResult>
ServiceDefinition { name, checker, critical?, timeoutMs?, tags? }
ServiceStatus { name, status, lastCheckedAt, responseTimeMs, consecutiveFailures, history[] }
AggregateHealthResult { status, services[], healthyCount, unhealthyCount, degradedCount, totalCount, checkDurationMs }
```

---

## 2. Fastify 플러그인: healthPlugin

### 설계 원칙
- fastify-plugin 기반 데코레이터 등록
- `/health/aggregate` -- 전체 집계 상태
- `/health/services` -- 등록 서비스 목록
- `/health/services/:name` -- 개별 서비스 체크
- 엔드포인트 노출 on/off 설정 가능

### HTTP 상태 코드 매핑
```
healthy → 200
degraded → 200
unhealthy → 503
```

---

## 3. 종속성 체크 패턴

### 등록 예시
```typescript
aggregator.register({
  name: 'postgres',
  critical: true,
  tags: ['database'],
  checker: async () => {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    return { status: 'healthy', responseTimeMs: Date.now() - start };
  },
});
```

---

## Session Guide

### 구현 순서
1. `src/health-aggregator.ts` -- 핵심 집계 클래스
2. `src/health-plugin.ts` -- Fastify 플러그인
3. `src/index.ts` -- 패키지 엔트리포인트
4. `tests/health-aggregator.test.ts` -- 단위 테스트
5. `tests/health-plugin.test.ts` -- 통합 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-HEALTHAGG-R23`
- 모든 함수: `// Plan SC: FR-HA.{번호}`
