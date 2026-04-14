# SVC-AI-ADV-R541 Design — 실시간 비용 이상 탐지 v2

## 인터페이스

```typescript
interface CostInput {
  serviceId: string;
  date: string;
  actualCost: number;
  budgetedCost: number;
  prevMonthCost: number;
}

interface CostAnomalyResult {
  serviceId: string;
  date: string;
  isAnomaly: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  overrunRate: number;  // (actual-budget)/budget*100, 소수점 2자리
}
```

## 핵심 알고리즘

- 이상 여부: actualCost > budgetedCost×1.2 OR actualCost > prevMonthCost×1.5
- 심각도: >budgetedCost×2→CRITICAL / >×1.5→HIGH / >×1.2→MEDIUM / else NORMAL
- 초과율: (actualCost - budgetedCost) / budgetedCost × 100 (소수점 2자리)
- 감사 로그: detect 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
