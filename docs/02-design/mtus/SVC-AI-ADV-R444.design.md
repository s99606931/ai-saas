# SVC-AI-ADV-R444 Design — realtime-health-predictor-v2.ts

Plan Ref: SVC-AI-ADV-R444.plan.md

## 클래스 설계

```typescript
class RealtimeHealthPredictorV2 {
  registerService(serviceId, name, baselineScore): Service
  recordMetrics(serviceId, cpuUsage, memUsage, errorRate, dataGrade?): HealthSnapshot
  getHealthScore(serviceId): number
  getAtRiskServices(threshold): Service[]
  getAuditLog(): AuditEntry[]
}
```

## 건전성 점수 공식
`score = Math.max(0, 100 - cpuUsage * 0.3 - memUsage * 0.3 - errorRate * 0.4)`

## 위험 탐지
`healthScore < threshold`
