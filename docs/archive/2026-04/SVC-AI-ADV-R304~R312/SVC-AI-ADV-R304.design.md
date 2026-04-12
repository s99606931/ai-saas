# SVC-AI-ADV-R304 Design: AI기반 마이크로서비스 성능 프로파일러

## 핵심 알고리즘

### 백분위수 계산
- 응답시간 배열 정렬 후 Math.ceil(n*0.95)-1 인덱스 → p95
- Math.ceil(n*0.99)-1 → p99
- avg = sum / n

### 병목 탐지
- p99 > sloTargetMs 이면 병목으로 분류

## 인터페이스 설계

```typescript
class MicroservicePerformanceProfilerAI {
  registerService(id, name, sloTargetMs): void
  recordMetrics(serviceId, cpuPercent, memoryMb, responseTimeMs, grade?): void
  getStats(serviceId): PerformanceStats
  getBottlenecks(): BottleneckInfo[]
  getAuditLog(): AuditEntry[]
}

interface PerformanceStats {
  serviceId: string
  avgResponseTimeMs: number
  p95ResponseTimeMs: number
  p99ResponseTimeMs: number
  sloTargetMs: number
  isBottleneck: boolean
}
```
