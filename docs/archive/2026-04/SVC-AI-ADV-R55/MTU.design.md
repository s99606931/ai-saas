# SVC-AI-ADV-R55 — AI Cost Allocation Design

> 2026-04-12 | v1.0.0

## 1. 개요
테넌트·모델·호출 단위로 AI API 비용을 추적하고 일/월 단위로 집계합니다.

## 2. 인터페이스
```typescript
export interface CallRecord {
  id: string;
  tenantId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number; // ms epoch
}

export interface PricingRule {
  modelId: string;
  inputPerKTok: number;   // KRW per 1k tokens
  outputPerKTok: number;  // KRW per 1k tokens
  effectiveFrom: number;  // ms epoch
}

export interface CostEntry extends CallRecord {
  cost: number;
}

export interface AggregateRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}
```

## 3. 비용 계산식
```
cost = (inputTokens / 1000) * inputPerKTok
     + (outputTokens / 1000) * outputPerKTok
```
동일 modelId에 대해 여러 `PricingRule`이 있으면 `timestamp >= effectiveFrom` 중 가장 최신 규칙을 선택.

## 4. 집계
- `aggregateByTenant(from, to)` → Map<tenantId, AggregateRow>
- `aggregateByModel(from, to)` → Map<modelId, AggregateRow>
- 기간(from,to)은 ms epoch 반개구간 [from, to)

## 5. 감사
- COST_RECORDED, PRICING_CHANGED, AGGREGATE_EXECUTED

## 6. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
