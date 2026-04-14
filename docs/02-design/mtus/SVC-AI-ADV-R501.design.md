# SVC-AI-ADV-R501 Design — microservice-performance-profiler-v2.ts

Plan Ref: SVC-AI-ADV-R501.plan.md

## 클래스 설계

```typescript
class MicroservicePerformanceProfilerV2 {
  registerService(serviceId, name, version): MicroService
  recordMetrics(serviceId, cpuPercent, memPercent, requestsPerSec, dataGrade?): void
  getPerformanceScore(serviceId): number   // max(0, 100 - cpu*0.4 - mem*0.3 - max(0,rps-100)*0.1)
  getLowPerformanceServices(): MicroService[]  // score < 60
  getAuditLog(): AuditEntry[]
}
```

## 성능 점수 공식
최신 메트릭 기준:
`score = Math.max(0, 100 - cpu*0.4 - mem*0.3 - Math.max(0, rps-100)*0.1)`
메트릭 없으면 100
