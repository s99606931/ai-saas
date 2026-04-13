# SVC-AI-ADV-R441 Design — multitenant-cost-allocation-optimizer.ts

Plan Ref: SVC-AI-ADV-R441.plan.md

## 클래스 설계

```typescript
class MultitenantCostAllocationOptimizer {
  addUsage(tenantId, resourceType, usageAmount, dataGrade?): void
  getCostBreakdown(totalCost): CostBreakdown[]
  getOverBudgetTenants(totalCost, threshold): CostBreakdown[]
  getAuditLog(): AuditEntry[]
}

interface CostBreakdown {
  tenantId: string
  usageAmount: number
  allocatedCost: number
  ratio: number  // 0-100 (%)
}
```

## 비용 배분 공식
`tenantCost = (tenantUsage / totalUsage) * totalCost`
`ratio = (tenantUsage / totalUsage) * 100`

## 초과 탐지
`allocatedCost > threshold`
