# SVC-AI-ADV-R307 Design: AI기반 서비스 가용성 예측

## 핵심 알고리즘

### 이동평균 예측
- 최근 N개(기본 5) 가용성 레코드의 평균
- 가중치: 최근 데이터에 더 높은 가중치 (index+1 기반)
- predictedAvailability = weighted sum / weight sum

### 경보 생성
- predictedAvailability < targetAvailability 이면 경보

## 인터페이스 설계

```typescript
class ServiceAvailabilityPredictorAI {
  registerService(id, name, targetAvailability): void
  recordAvailability(serviceId, availabilityPercent, grade?): void
  predictAvailability(serviceId, windowSize?): PredictionResult
  getAlerts(): AvailabilityAlert[]
  getAuditLog(): AuditEntry[]
}

interface PredictionResult {
  serviceId: string
  predictedAvailability: number
  targetAvailability: number
  atRisk: boolean
}
```
