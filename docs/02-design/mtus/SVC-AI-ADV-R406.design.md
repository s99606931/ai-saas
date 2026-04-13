# SVC-AI-ADV-R406 Design: AI기반 실시간 데이터 스트림 이상 탐지 v2

## 핵심 알고리즘

### Z-Score 기반 이상 탐지
- `mean = sum(values) / n`
- `stdDev = sqrt(sum((v - mean)^2) / n)`
- `z = |value - mean| / stdDev`
- stdDev = 0이면 z = 0 (모든 값이 동일)
- `|z| > zScoreThreshold` → 이상 이벤트 생성

## 클래스 설계

```typescript
class RealtimeStreamAnomalyDetectorV2 {
  registerStream(id, name, zScoreThreshold): void
  recordDataPoint(streamId, value, grade): AnomalyEvent | null
  getAnomalyEvents(streamId): AnomalyEvent[]
  getAuditLog(): AuditEntry[]
}
```
