# SVC-AI-ADV-R346 Design: AI기반 클라우드 비용 예측 v2

## 핵심 알고리즘

### 선형 추세 예측
- 최근 N개 비용 데이터의 단순 이동평균
- predictedCost = sum(recent) / recent.length
- budget 초과: predictedCost > budgetLimit → alert

## 인터페이스 설계

```typescript
class CloudCostPredictorV2 {
  registerService(id, name, budgetLimit): void
  recordCost(serviceId, cost, period, grade?): void
  predictCost(serviceId, windowSize?): CostPrediction
  getBudgetAlerts(): BudgetAlert[]
  getAuditLog(): AuditEntry[]
}

interface CostPrediction {
  serviceId: string
  predictedCost: number
  budgetLimit: number
  overBudget: boolean
  samplesUsed: number
}
```
