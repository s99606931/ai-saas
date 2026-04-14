// Design Ref: §부정 대화 기준 — ComplaintConversationAnalyzerV2
// Plan SC: SVC-AI-ADV-R506

import { createHash } from 'crypto'

type Sentiment = 'positive' | 'neutral' | 'negative'

interface Conversation {
  conversationId: string
  citizenId: string
  channel: string
}

interface ConversationMessage {
  conversationId: string
  content: string
  sentiment: Sentiment
}

interface AuditEntry {
  timestamp: string
  action: string
  conversationId: string
  maskedCitizenId?: string
  details?: Record<string, unknown>
}

export class ComplaintConversationAnalyzerV2 {
  private conversations = new Map<string, Conversation>()
  private messages: ConversationMessage[] = []
  private auditLog: AuditEntry[] = []

  registerConversation(conversationId: string, citizenId: string, channel: string): Conversation {
    const convo: Conversation = { conversationId, citizenId, channel }
    this.conversations.set(conversationId, convo)
    const maskedCitizenId = createHash('sha256').update(citizenId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_CONVERSATION',
      conversationId,
      maskedCitizenId,
      details: { channel },
    })
    return convo
  }

  addMessage(
    conversationId: string,
    content: string,
    sentiment: Sentiment,
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.conversations.has(conversationId)) {
      throw new Error(`대화를 찾을 수 없습니다: ${conversationId}`)
    }
    this.messages.push({ conversationId, content, sentiment })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_MESSAGE',
      conversationId,
      details: { sentiment, contentLength: content.length },
    })
  }

  getSentimentStats(conversationId: string): { positive: number; neutral: number; negative: number } {
    const msgs = this.messages.filter((m) => m.conversationId === conversationId)
    const total = msgs.length
    if (total === 0) return { positive: 0, neutral: 0, negative: 0 }
    return {
      positive: msgs.filter((m) => m.sentiment === 'positive').length / total,
      neutral: msgs.filter((m) => m.sentiment === 'neutral').length / total,
      negative: msgs.filter((m) => m.sentiment === 'negative').length / total,
    }
  }

  getNegativeConversations(): Conversation[] {
    return Array.from(this.conversations.values()).filter((convo) => {
      const msgs = this.messages.filter((m) => m.conversationId === convo.conversationId)
      if (msgs.length === 0) return false
      const negRate = msgs.filter((m) => m.sentiment === 'negative').length / msgs.length
      return negRate > 0.5
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
