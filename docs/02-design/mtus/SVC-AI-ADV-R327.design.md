# SVC-AI-ADV-R327 Design: AI기반 감사 추적 강화

## 핵심 알고리즘

### 위험 패턴 탐지
- 시간 창(windowMs) 내 동일 actorId 이벤트 수 > threshold → suspicious
- 허가되지 않은 리소스 접근: allowedResources에 없는 resource 접근 → unauthorized

### 마스킹
- actorId SHA-256 16자 해시로 마스킹 (PII 보호)

## 인터페이스 설계

```typescript
class AuditTrailEnhancerAI {
  registerPolicy(id, name, allowedResources: string[], maxEventsPerWindow, windowMs): void
  recordEvent(policyId, actorId, resource, action, grade?): void
  getRiskAlerts(policyId): RiskAlert[]
  getEnhancedLog(): EnhancedAuditEntry[]
  getAuditLog(): AuditEntry[]
}

interface RiskAlert {
  policyId: string
  alertType: 'suspicious_frequency' | 'unauthorized_access'
  maskedActorId: string
  resource: string
  eventCount?: number
  timestamp: number
}
```
