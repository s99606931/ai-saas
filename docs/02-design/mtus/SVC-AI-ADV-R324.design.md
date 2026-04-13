# SVC-AI-ADV-R324 Design: AI기반 클라우드 리소스 이상 탐지

## 핵심 알고리즘

### 이상 탐지
- cpuPercent > cpuThreshold → anomaly
- memoryPercent > memoryThreshold → anomaly
- networkMbps > networkThreshold → anomaly

### 심각도 분류
- 임계값의 150% 초과: critical
- 임계값 초과 (100%~150%): warning

## 인터페이스 설계

```typescript
class CloudResourceAnomalyDetector {
  registerResource(id, name, thresholds: {cpuPercent, memoryPercent, networkMbps}): void
  recordUsage(resourceId, cpuPercent, memoryPercent, networkMbps, grade?): void
  getAnomalies(resourceId): AnomalyEvent[]
  getActiveAnomalies(): AnomalyEvent[]
  getAuditLog(): AuditEntry[]
}

interface AnomalyEvent {
  resourceId: string
  metric: 'cpu' | 'memory' | 'network'
  value: number
  threshold: number
  severity: 'warning' | 'critical'
  timestamp: number
}
```
