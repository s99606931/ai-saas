# SVC-AI-ADV-R504 Design — service-dependency-health-v2.ts

Plan Ref: SVC-AI-ADV-R504.plan.md

## 클래스 설계

```typescript
class ServiceDependencyHealthV2 {
  registerService(serviceId, name, version): ServiceNode
  recordDependencyHealth(serviceId, dependencyId, latencyMs, errorRate, dataGrade?): void
  getHealthScore(serviceId, dependencyId): number   // max(0, 100 - latencyMs/10 - errorRate*2)
  getUnhealthyDependencies(serviceId): DependencyRecord[]  // score < 60
  getAuditLog(): AuditEntry[]
}
```

## 건강 점수
`score = Math.max(0, 100 - latencyMs/10 - errorRate*2)`
