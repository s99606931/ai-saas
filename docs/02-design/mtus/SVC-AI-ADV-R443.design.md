# SVC-AI-ADV-R443 Design — public-service-touchpoint-analyzer.ts

Plan Ref: SVC-AI-ADV-R443.plan.md

## 클래스 설계

```typescript
class PublicServiceTouchpointAnalyzer {
  registerTouchpoint(touchpointId, name, channel): Touchpoint
  recordInteraction(touchpointId, citizenId, satisfactionScore, waitTimeMs, dataGrade?): void
  getTouchpointStats(touchpointId): TouchpointStats
  getLowSatisfactionTouchpoints(threshold): Touchpoint[]
  getAuditLog(): AuditEntry[]
}

interface TouchpointStats {
  avgSatisfaction: number
  avgWaitTimeMs: number
  count: number
}
```

## PII 마스킹
`createHash('sha256').update(citizenId).digest('hex').substring(0, 16)`
