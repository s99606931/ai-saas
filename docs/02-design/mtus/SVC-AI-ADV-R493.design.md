# SVC-AI-ADV-R493 Design — public-kpi-automator-v2.ts

Plan Ref: SVC-AI-ADV-R493.plan.md

## 클래스 설계

```typescript
class PublicKpiAutomatorV2 {
  registerKpi(kpiId, name, targetValue, unit): KpiItem
  recordActual(kpiId, actualValue, dataGrade?): void
  getAchievementRate(kpiId): number   // actualValue/targetValue*100
  getUnderperformingKpis(): KpiItem[] // achievementRate < 100
  getAuditLog(): AuditEntry[]
}
```

## 달성률 공식
`achievementRate = latestActualValue / targetValue * 100`
