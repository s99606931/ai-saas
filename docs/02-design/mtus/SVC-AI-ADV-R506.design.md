# SVC-AI-ADV-R506 Design — complaint-conversation-analyzer-v2.ts

Plan Ref: SVC-AI-ADV-R506.plan.md

## 클래스 설계

```typescript
type Sentiment = 'positive' | 'neutral' | 'negative'

class ComplaintConversationAnalyzerV2 {
  registerConversation(conversationId, citizenId, channel): Conversation
  addMessage(conversationId, content, sentiment, dataGrade?): void
  getSentimentStats(conversationId): { positive: number, neutral: number, negative: number }
  getNegativeConversations(): Conversation[]  // negative 비율 > 50%
  getAuditLog(): AuditEntry[]
}
```

## 부정 대화 기준
negative 메시지 수 / 전체 메시지 수 > 0.5
