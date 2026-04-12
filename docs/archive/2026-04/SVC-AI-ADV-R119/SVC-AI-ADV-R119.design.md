# SVC-AI-ADV-R119 — AI Load Balancer (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: 전략 패턴(Strategy) + 메트릭 수집기 + 헬스 레지스트리
- **선정 이유**: Pragmatic Balance — 전략 교체 가능, 부하/비용/레이턴시 균형

## 인터페이스

```typescript
type Strategy = 'round-robin' | 'weighted' | 'least-loaded' | 'cost-optimal' | 'latency-optimal'
type Health = 'healthy' | 'degraded' | 'down'

interface Backend {
  id: string
  weight: number
  maxConcurrency: number
  costPerToken: number   // USD per 1k tokens
  tags?: string[]
}

interface BackendMetrics {
  inFlight: number
  totalRequests: number
  successCount: number
  failureCount: number
  p95LatencyMs: number
  lastLatencies: number[]
  health: Health
}

class AILoadBalancer {
  constructor(options?: { strategy?: Strategy })
  register(backend: Backend): void
  select(grade: DataGrade, hint?: { tag?: string }): Backend
  recordSuccess(id: string, latencyMs: number): void
  recordFailure(id: string): void
  setHealth(id: string, health: Health): void
  getMetrics(id: string): BackendMetrics | undefined
  getAuditLog(): readonly LBAuditEntry[]
}
```

## 전략 로직

- round-robin: 단순 순환 (healthy만)
- weighted: weight 기준 누적 분포
- least-loaded: inFlight 최소 선택
- cost-optimal: costPerToken 최소 선택
- latency-optimal: p95LatencyMs 최소 선택

## 동시성·헬스

- select() 시 inFlight++, record 시 inFlight--
- maxConcurrency 초과 시 다른 백엔드 선택
- health=down 백엔드는 무조건 제외
- 성공 시 p95 윈도우 20개 갱신
- 실패율 > 50% (최근 10) → degraded 자동 전환

## Session Guide

1. register로 다수 백엔드 등록
2. select 호출 → 전략에 따라 백엔드 반환 + inFlight++
3. 실제 호출 후 recordSuccess/recordFailure로 반영
4. 과부하/다운 시 fallback 체인 자동 시도
