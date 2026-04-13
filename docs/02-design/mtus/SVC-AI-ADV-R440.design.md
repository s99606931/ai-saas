# SVC-AI-ADV-R440 Design — communication-pattern-analyzer-ai.ts

Plan Ref: SVC-AI-ADV-R440.plan.md

## 클래스 설계

```typescript
class CommunicationPatternAnalyzerAI {
  addEvent(eventId, channel, participantId, durationMs, dataGrade?): CommEvent
  getChannelStats(channel): { avgDurationMs: number, eventCount: number }
  getInefficientChannels(thresholdMs): ChannelStat[]
  getAuditLog(): AuditEntry[]
}
```

## PII 마스킹
`createHash('sha256').update(participantId).digest('hex').substring(0, 16)`

## 비효율 탐지
`avgDurationMs > thresholdMs` → 비효율 채널 반환
