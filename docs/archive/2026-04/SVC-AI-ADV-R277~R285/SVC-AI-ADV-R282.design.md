# SVC-AI-ADV-R282 Design: AI기반 공공기관 예산 계획 지원

## 핵심 알고리즘

### 집행률 계산
- executionRate = totalSpent / allocatedAmount * 100
- 상태: under(<80%), on_track(80~100%), over(>100%)

### 차기 예산 추천
- 과집행(>100%): 집행액의 110% 추천
- 정상(80~100%): 집행액의 105% 추천
- 미집행(<80%): 집행액의 100% 추천 (삭감 방지)

## 인터페이스 설계

```typescript
class BudgetPlanningAssistantAI {
  registerBudgetItem(id, name, allocatedAmount, fiscalYear): void
  recordExpenditure(itemId, amount, date, grade?): void
  getExecutionRate(itemId): ExecutionResult
  recommendNextBudget(itemId): BudgetRecommendation
  getAuditLog(): AuditEntry[]
}

interface ExecutionResult {
  itemId: string
  allocatedAmount: number
  totalSpent: number
  executionRate: number
  status: 'under' | 'on_track' | 'over'
}
```
