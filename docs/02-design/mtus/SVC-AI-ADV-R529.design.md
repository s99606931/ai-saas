# SVC-AI-ADV-R529 Design — service-continuity-assurer-ai.ts
Plan Ref: SVC-AI-ADV-R529.plan.md
## 클래스 설계
```typescript
class ServiceContinuityAssurerAi {
  registerService(serviceId, name, rto, rpo): ContinuityService
  recordOutage(serviceId, duration, impact, dataGrade?): void
  getContinuityScore(serviceId): number  // max(0, 100 - totalOutageDuration/rto*50 - totalImpact*10)
  getAtRiskServices(): ContinuityService[]  // score < 60
  getAuditLog(): AuditEntry[]
}
```
