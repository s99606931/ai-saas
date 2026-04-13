// Design Ref: §R386 — AI기반 공공기관 대화형 AI 어시스턴트
// Plan SC: SC-R386

export interface ConversationSession {
  sessionId: string
  userId: string
  department: string
  language: 'ko' | 'en'
  dataGrade: 'C' | 'S' | 'O'
}

export interface ConversationTurn {
  sessionId: string
  turnId: string
  userMessage: string
  timestamp: number
}

export interface AssistantResponse {
  sessionId: string
  turnId: string
  maskedUserId: string
  response: string
  intent: string
  confidence: number
  suggestedActions: string[]
  requiresHumanHandoff: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const INTENT_PATTERNS: { intent: string; keywords: string[]; response: string; actions: string[] }[] = [
  { intent: 'COMPLAINT_INQUIRY', keywords: ['민원', '신청', '접수', '처리'], response: '민원 접수 및 처리 현황을 안내해 드립니다.', actions: ['민원 조회', '민원 신청'] },
  { intent: 'DOCUMENT_REQUEST', keywords: ['서류', '증명서', '발급', '신청서'], response: '필요한 서류 발급 방법을 안내해 드립니다.', actions: ['서류 신청', '구비서류 확인'] },
  { intent: 'PAYMENT_INQUIRY', keywords: ['납부', '수수료', '세금', '요금'], response: '납부 관련 정보를 안내해 드립니다.', actions: ['납부 조회', '납부 방법 안내'] },
  { intent: 'HOURS_INQUIRY', keywords: ['운영시간', '접수시간', '업무시간', '휴무'], response: '업무 운영 시간을 안내해 드립니다.', actions: ['운영시간 확인'] },
]

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

export class PublicConversationalAiAssistant {
  private sessions = new Map<string, ConversationSession>()
  private auditLog: AuditEntry[] = []

  createSession(session: ConversationSession): void {
    // N2SF: C/S 등급 대화 세션 차단
    if (session.dataGrade === 'C' || session.dataGrade === 'S') {
      throw new Error(`BLOCKED: ${session.dataGrade}등급 데이터 대화 세션 차단 (N2SF N-05)`)
    }
    this.sessions.set(session.sessionId, session)
    this.auditLog.push({ action: 'session.create', timestamp: new Date().toISOString(), detail: `${session.sessionId}(${maskUserId(session.userId)})` })
  }

  respond(turn: ConversationTurn): AssistantResponse {
    const session = this.sessions.get(turn.sessionId)
    if (!session) throw new Error(`Session not found: ${turn.sessionId}`)

    const message = turn.userMessage.toLowerCase()
    let matchedIntent = { intent: 'UNKNOWN', response: '안내 담당자에게 연결해 드리겠습니다.', actions: [] as string[], confidence: 0.3 }

    for (const pattern of INTENT_PATTERNS) {
      const matches = pattern.keywords.filter((kw) => message.includes(kw)).length
      if (matches > 0) {
        const confidence = Math.min(0.95, 0.5 + matches * 0.15)
        if (confidence > matchedIntent.confidence) {
          matchedIntent = { intent: pattern.intent, response: pattern.response, actions: pattern.actions, confidence }
        }
      }
    }

    const requiresHumanHandoff = matchedIntent.confidence < 0.5 || matchedIntent.intent === 'UNKNOWN'

    this.auditLog.push({ action: 'assistant.respond', timestamp: new Date().toISOString(), detail: `${turn.sessionId}:${matchedIntent.intent}` })
    return {
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      maskedUserId: maskUserId(session.userId),
      response: matchedIntent.response,
      intent: matchedIntent.intent,
      confidence: Math.round(matchedIntent.confidence * 100) / 100,
      suggestedActions: matchedIntent.actions,
      requiresHumanHandoff,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
