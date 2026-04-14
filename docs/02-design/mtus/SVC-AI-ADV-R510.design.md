# SVC-AI-ADV-R510 Design — realtime-pricing-optimizer-v2.ts

Plan Ref: SVC-AI-ADV-R510.plan.md

## 클래스 설계

```typescript
class RealtimePricingOptimizerV2 {
  registerPlan(planId, name, basePrice, unit): PricingPlan
  recordDemand(planId, demandLevel, dataGrade?): void
  getOptimalPrice(planId): number   // basePrice * (1 + demandLevel/100 * 0.5)
  getHighDemandPlans(): PricingPlan[]  // latestDemandLevel >= 70
  getAuditLog(): AuditEntry[]
}
```

## 최적 가격 공식
`optimalPrice = basePrice * (1 + latestDemandLevel / 100 * 0.5)`
demandLevel 없으면 basePrice 반환
