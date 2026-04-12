# SVC-AI-ADV-R234 Design: AI기반 서비스 메시 트래픽 최적화

## 구현 파일
`platform/services/ai-service/src/lib/service-mesh-traffic-optimizer.ts`

## 핵심 설계
- `ServiceNode`: nodeId, currentPolicy (ROUND_ROBIN 등)
- `TrafficMetric`: requestCount, errorCount, avgLatencyMs
- 최근 5개 메트릭 평균 계산
- errorRate ≥ 0.5 → OPEN (retryBudget=0)
- errorRate 0.2~0.5 → HALF_OPEN (retryBudget=25)
- avgLatency > 500ms → LEAST_REQUEST 권고
