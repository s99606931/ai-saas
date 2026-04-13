# SVC-AI-ADV-R329 Design: AI기반 API 부하 자동 분산

## 핵심 알고리즘

### 가중치 기반 라우팅
- 활성(active) 엔드포인트만 대상
- 각 엔드포인트의 weight / totalWeight = 선택 확률
- route() 호출 시: 누적 가중치 비교로 엔드포인트 선택

### 부하 통계
- 엔드포인트별 라우팅 횟수 추적
- 실제 분산 비율 = routeCount / totalRouted * 100

## 인터페이스 설계

```typescript
class ApiLoadAutoDistributor {
  registerEndpoint(id, url, weight, status): void
  route(grade?): RoutingDecision
  recordLatency(endpointId, latencyMs): void
  getLoadStats(): LoadStats[]
  getAuditLog(): AuditEntry[]
}

interface RoutingDecision {
  endpointId: string
  url: string
  weight: number
  timestamp: number
}

interface LoadStats {
  endpointId: string
  url: string
  routeCount: number
  weight: number
  avgLatencyMs: number
}
```
