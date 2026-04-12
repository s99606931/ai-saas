# SVC-AI-ADV-R278 Design: AI기반 공공 서비스 이용 패턴 분석

## 핵심 알고리즘

### 이용 기록 및 집계
- SHA-256으로 userId PII 마스킹
- 시간대(hour)별 이용 횟수 집계: `Map<hour, count>`
- 피크 시간대: 최대 count를 가진 hour

### 트렌드 분석
- 일별 집계 후 최근 7일 vs 이전 7일 평균 비교
- trend: 'increasing' | 'stable' | 'decreasing'

## 인터페이스 설계

```typescript
class PublicServiceUsageAnalyzer {
  registerService(id, name, category): void
  recordUsage(serviceId, userId, timestamp, grade?): void
  getHourlyPattern(serviceId): HourlyPattern
  getPeakHour(serviceId): number
  analyzeTrend(serviceId): TrendResult
  getAuditLog(): AuditEntry[]
}
```
