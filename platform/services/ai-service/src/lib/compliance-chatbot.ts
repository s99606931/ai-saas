/**
 * Compliance Chatbot — SVC-AI-ADV-R164 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R164/SVC-AI-ADV-R164.design.md
 * Plan SC: FR-R164.1 ~ FR-R164.5
 *
 * 규정 KB 기반 챗봇 — 키워드 검색 + 멀티턴 대화 이력 + 감사 로그.
 * N2SF N-05: C/S 등급 세션 차단. CSAP D-06: 감사 로그.
 */

// Design Ref: §타입 정의

export type DataGrade = 'C' | 'S' | 'O'
export type ComplianceStandard = 'CSAP' | 'ISMS-P' | 'N2SF' | 'GDPR' | '행안부감리'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  referenceIds?: string[]
}

export interface ComplianceRule {
  id: string
  standard: ComplianceStandard
  title: string
  description: string
  keywords: string[]
  severity: 'high' | 'medium' | 'low'
}

export interface AuditEntry {
  timestamp: string
  action: string
  sessionId: string
  detail: Record<string, unknown>
}

export class ComplianceChatbot {
  private readonly rules: ComplianceRule[] = []
  private readonly sessions = new Map<string, ChatMessage[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R164.1 — 규정 KB 등록
  registerRule(rule: ComplianceRule): void {
    this.rules.push({ ...rule, keywords: [...rule.keywords] })
  }

  // Plan SC: FR-R164.2 — 키워드 기반 규정 검색
  searchRules(query: string): ComplianceRule[] {
    const lower = query.toLowerCase()
    return this.rules.filter(
      (r) =>
        r.keywords.some((k) => lower.includes(k.toLowerCase())) ||
        r.title.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower),
    )
  }

  // Plan SC: FR-R164.3 — N2SF N-05 + 멀티턴 질의응답
  chat(sessionId: string, userMessage: string, grade: DataGrade = 'O'): ChatMessage {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 챗봇 질의 금지 (N2SF N-05)`)
    }

    const matched = this.searchRules(userMessage)
    let content: string
    if (matched.length === 0) {
      content = `"${userMessage}"에 해당하는 규정을 찾지 못했습니다. 더 구체적인 키워드로 질의해주세요.`
    } else {
      const topRules = matched.slice(0, 3)
      const lines = topRules.map((r) => `[${r.standard}/${r.id}] ${r.title}: ${r.description}`)
      content = `관련 규정 ${matched.length}건 발견:\n\n${lines.join('\n\n')}`
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      referenceIds: matched.map((r) => r.id),
    }

    const history = this.sessions.get(sessionId) ?? []
    history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() })
    history.push(assistantMsg)
    this.sessions.set(sessionId, history)

    this.appendAudit('chat.query', sessionId, { matchCount: matched.length })
    return assistantMsg
  }

  // Plan SC: FR-R164.4 — 대화 이력 조회
  getHistory(sessionId: string): ChatMessage[] {
    return [...(this.sessions.get(sessionId) ?? [])]
  }

  // Plan SC: FR-R164.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, sessionId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, sessionId, detail })
  }
}
