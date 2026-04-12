# SVC-AI-ADV-R123 — AI Token Budget Manager (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Registry(테넌트 예산) + Rolling Window Aggregator + Guard
- **선정 이유**: Pragmatic Balance — DB 없이 메모리 카운터로 초기 비용 최소화 + 후속 Redis 백엔드 swap 가능
- **대안**:
  1. DB 테이블 기반 — 정확도↑, 복잡도↑
  2. 메모리 기반(선정) — 초기 구현 단순, 단일 노드 한정
  3. Redis TTL 기반 — 확장성↑, 외부 의존

## 인터페이스

```typescript
export type BudgetWindow = 'minute' | 'hour' | 'day' | 'month'

export interface TenantBudgetLimits {
  minute?: number
  hour?: number
  day?: number
  month?: number
}

export interface ModelCostWeight {
  model: string
  inputMultiplier: number   // 기본 1.0
  outputMultiplier: number  // 기본 1.0 (output 토큰이 보통 비쌈)
}

export interface ConsumeRequest {
  tenantId: string
  model: string
  inputTokens: number
  outputTokens: number
  grade: DataGrade
  timestamp?: number  // ms
}

export interface ConsumeRecord {
  tenantId: string
  model: string
  effectiveTokens: number  // weighted
  timestamp: number
}

export interface RemainingReport {
  tenantId: string
  limits: TenantBudgetLimits
  used: Record<BudgetWindow, number>
  remaining: Record<BudgetWindow, number>
  utilization: Record<BudgetWindow, number>  // 0~1
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly window: BudgetWindow,
    public readonly limit: number,
    public readonly attempted: number,
  )
}

export type BudgetWarningListener = (evt: {
  tenantId: string
  window: BudgetWindow
  utilization: number
}) => void

class AITokenBudgetManager {
  registerTenant(tenantId: string, limits: TenantBudgetLimits): void
  setModelWeight(weight: ModelCostWeight): void
  consume(req: ConsumeRequest): ConsumeRecord  // throw QuotaExceededError
  getRemaining(tenantId: string): RemainingReport
  onWarning(listener: BudgetWarningListener): void
  setWarningThreshold(ratio: number): void  // 기본 0.8
  getAuditLog(): readonly BudgetAuditEntry[]
}
```

## 윈도우 계산

- minute: (now - 60_000)
- hour: (now - 3_600_000)
- day: (now - 86_400_000)
- month: (now - 30 * 86_400_000) — 단순 30일 롤링
- 내부 구조: 테넌트별 `ConsumeRecord[]` 정렬 저장, 소비 시 오래된 month 초과 레코드 GC

## 가중치 계산

```
effective = input * inputMultiplier + output * outputMultiplier
```

모델 가중치 미등록 시 1.0/1.0.

## 경고 동작

소비 후 각 window utilization 계산. 임계값(기본 0.8) 이상이면 listener 호출. 한번에 여러 window가 초과 가능.

## 감사 로그 액션

`registerTenant` | `setModelWeight` | `consume` | `quotaExceeded` | `warning` | `gradeBlocked`

## Session Guide

1. registerTenant로 테넌트 예산 등록
2. setModelWeight로 모델 비용 설정
3. LLM 호출 전후 consume() 호출 (grade=O 필수)
4. 경고 리스너 등록 (운영팀 알림)
5. 관리 대시보드: getRemaining()로 잔여량 조회
