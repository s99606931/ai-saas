# SVC-AI-ADV-R498 Design — api-response-quality-evaluator-v2.ts

Plan Ref: SVC-AI-ADV-R498.plan.md

## 클래스 설계

```typescript
class ApiResponseQualityEvaluatorV2 {
  registerEndpoint(endpointId, path, method): ApiEndpoint
  recordResponse(endpointId, statusCode, latencyMs, dataGrade?): void
  getQualityScore(endpointId): number   // max(0, 2xxRate*60 + (1-avgLatency/1000)*40)
  getLowQualityEndpoints(): ApiEndpoint[] // score < 60
  getAuditLog(): AuditEntry[]
}
```

## 품질 점수 공식
`score = Math.max(0, successRate*60 + Math.max(0, (1-avgLatencyMs/1000))*40)`
2xx: statusCode >= 200 && statusCode < 300
