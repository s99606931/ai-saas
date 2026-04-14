# SVC-AI-ADV-R507 Design — multicloud-resource-optimizer-v2.ts

Plan Ref: SVC-AI-ADV-R507.plan.md

## 클래스 설계

```typescript
class MulticloudResourceOptimizerV2 {
  registerResource(resourceId, provider, resourceType, monthlyCost): CloudResource
  recordUtilization(resourceId, utilizationPercent, dataGrade?): void
  getWastedCost(resourceId): number   // monthlyCost * (1 - latestUtilization/100)
  getOptimizationTargets(): CloudResource[]  // utilization < 30%
  getAuditLog(): AuditEntry[]
}
```

## 낭비 비용
`wastedCost = monthlyCost * (1 - utilizationPercent / 100)`
