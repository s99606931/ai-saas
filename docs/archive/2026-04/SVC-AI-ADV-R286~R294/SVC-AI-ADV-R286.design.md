# SVC-AI-ADV-R286 Design: AI기반 SLA 위반 예방

## 핵심 알고리즘

### SLA 위험 수준 계산
- 응답시간: current / target > 0.9 이면 warning, > 1.0 이면 critical
- 가용성: current < target * 0.99 이면 warning, < target * 0.95 이면 critical
- 오류율: current > target * 1.1 이면 warning, > target * 1.5 이면 critical
- 3가지 중 하나라도 critical이면 전체 critical, warning이면 warning, 모두 정상이면 safe

## 인터페이스 설계

```typescript
class SlaViolationPreventerAI {
  registerSla(serviceId, name, targetResponseTimeMs, targetAvailability, targetErrorRate): void
  recordMetrics(serviceId, responseTimeMs, availabilityPercent, errorRate, grade?): void
  getRiskLevel(serviceId): SlaRiskResult
  getAtRiskServices(): SlaRiskResult[]
  getAuditLog(): AuditEntry[]
}

interface SlaRiskResult {
  serviceId: string
  serviceName: string
  riskLevel: 'safe' | 'warning' | 'critical'
  violations: string[]
}
```
