# SVC-AI-ADV-R445 Design — audit-trail-enhancer-v2.ts

Plan Ref: SVC-AI-ADV-R445.plan.md

## 클래스 설계

```typescript
class AuditTrailEnhancerV2 {
  recordEvent(eventType, actorId, resourceId, dataGrade?): EnhancedAuditEvent
  getEventTypeStats(): Record<string, number>
  getEventsByType(eventType): EnhancedAuditEvent[]
  getAuditLog(): AuditEntry[]
}

interface EnhancedAuditEvent {
  eventType: string
  maskedActorId: string  // SHA-256 16자 hex
  resourceId: string
  checksum: string       // SHA-256 16자 hex
  timestamp: string
}
```

## PII 마스킹
`createHash('sha256').update(actorId).digest('hex').substring(0, 16)`

## 체크섬 생성
`createHash('sha256').update(eventType + maskedActorId + resourceId).digest('hex').substring(0, 16)`
