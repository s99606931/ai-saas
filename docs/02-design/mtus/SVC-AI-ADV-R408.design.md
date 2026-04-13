# SVC-AI-ADV-R408 Design: AI기반 자동 서비스 성능 벤치마킹 v2

## 핵심 알고리즘

### 회귀 탐지
- `avgResponseMs = sum(responseMsValues) / count`
- 회귀 조건: `avgResponseMs > baselineMs * 1.2`
- 회귀율: `(avgResponseMs / baselineMs - 1) * 100`

## 클래스 설계

```typescript
class ServicePerformanceBenchmarkerV2 {
  registerService(id, name, baselineMs): void
  recordMeasurement(serviceId, responseMs, grade): void
  getBenchmarkResult(serviceId): BenchmarkResult
  getRegressions(): BenchmarkResult[]
  getAuditLog(): AuditEntry[]
}
```
