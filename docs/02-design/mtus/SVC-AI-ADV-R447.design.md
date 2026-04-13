# SVC-AI-ADV-R447 Design — service-mesh-routing-optimizer-v2.ts

Plan Ref: SVC-AI-ADV-R447.plan.md

## 클래스 설계

```typescript
class ServiceMeshRoutingOptimizerV2 {
  addEndpoint(endpointId, serviceId, latencyMs, weight, dataGrade?): Endpoint
  getBestEndpoint(serviceId): Endpoint | null  // score = weight / latencyMs
  getServiceEndpoints(serviceId): Endpoint[]
  getHighLatencyEndpoints(thresholdMs): Endpoint[]
  getAuditLog(): AuditEntry[]
}

interface Endpoint {
  endpointId: string
  serviceId: string
  latencyMs: number
  weight: number
}
```

## 최적 엔드포인트 선택
`score = weight / latencyMs` → 최대 score 엔드포인트 반환

## 고지연 탐지
`latencyMs > thresholdMs`
