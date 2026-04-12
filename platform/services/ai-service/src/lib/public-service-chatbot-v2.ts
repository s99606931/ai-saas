/**
 * Public Service Chatbot V2 — SVC-AI-ADV-R148 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R148.design.md
 * Plan SC: FR-R148.1 ~ FR-R148.6
 *
 * 멀티턴 대화 + 맥락 유지 + 페르소나 공공 서비스 챗봇.
 * N2SF N-05: C/S 등급 차단. 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type DataGrade = 'C' | 'S' | 'O'
export type Role = 'user' | 'assistant' | 'system'

export interface Turn {
  role: Role
  content: string
  timestamp: string
}

export interface Session {
  sessionId: string
  persona: string
  grade: DataGrade
  turns: Turn[]
  startedAt: string
  endedAt?: string
}

export interface SessionSummary {
  sessionId: string
  turnCount: number
  keywords: string[]
  summary: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  sessionId: string
  detail: Record<string, unknown>
}

const MAX_TURNS = 100

export class PublicServiceChatbotV2 {
  private readonly sessions = new Map<string, Session>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R148.1 — Design Ref: §3.1 N2SF 차단
  startSession(sessionId: string, persona: string, dataGrade: DataGrade = 'O'): Session {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 세션 생성 금지 (N2SF N-05)`)
    }
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session already exists: ${sessionId}`)
    }
    const session: Session = {
      sessionId,
      persona,
      grade: dataGrade,
      turns: [],
      startedAt: new Date().toISOString(),
    }
    this.sessions.set(sessionId, session)
    this.appendAudit('session.start', sessionId, { persona })
    return { ...session, turns: [] }
  }

  // Plan SC: FR-R148.2
  addTurn(sessionId: string, role: Role, content: string): Turn {
    const session = this.getSession(sessionId)
    if (session.endedAt) throw new Error(`Session ended: ${sessionId}`)

    const turn: Turn = { role, content, timestamp: new Date().toISOString() }
    session.turns.push(turn)
    // 최대 턴 수 초과 시 오래된 비-system 턴 제거
    if (session.turns.length > MAX_TURNS) {
      const firstNonSystem = session.turns.findIndex((t) => t.role !== 'system')
      if (firstNonSystem !== -1) session.turns.splice(firstNonSystem, 1)
    }
    return { ...turn }
  }

  // Plan SC: FR-R148.3 — Design Ref: §3.2 슬라이딩 윈도우
  getContext(sessionId: string, maxTurns = 10): Turn[] {
    const session = this.getSession(sessionId)
    return session.turns.slice(-maxTurns).map((t) => ({ ...t }))
  }

  // Plan SC: FR-R148.4 — Design Ref: §3.3 키워드 기반 요약
  summarizeSession(sessionId: string): SessionSummary {
    const session = this.getSession(sessionId)
    const userTurns = session.turns.filter((t) => t.role === 'user')
    const allText = userTurns.map((t) => t.content).join(' ')

    // 키워드 추출: 2글자+ 토큰 빈도 상위 5개
    const tokenFreq = new Map<string, number>()
    const tokens = allText.split(/[\s,.:;!?()[\]{}"'""''·\-\/\\]+/)
    for (const token of tokens) {
      if (token.length >= 2) {
        tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1)
      }
    }
    const keywords = [...tokenFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k)

    const summary =
      userTurns.length === 0
        ? '대화 내용 없음'
        : `총 ${session.turns.length}개 턴. 주요 주제: ${keywords.join(', ')}`

    this.appendAudit('session.summarize', sessionId, { turnCount: session.turns.length })
    return { sessionId, turnCount: session.turns.length, keywords, summary }
  }

  // Plan SC: FR-R148.5
  endSession(sessionId: string): SessionSummary {
    const session = this.getSession(sessionId)
    session.endedAt = new Date().toISOString()
    const summary = this.summarizeSession(sessionId)
    this.appendAudit('session.end', sessionId, { turnCount: session.turns.length })
    return summary
  }

  // Plan SC: FR-R148.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Unknown session: ${sessionId}`)
    return session
  }

  private appendAudit(action: string, sessionId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, sessionId, detail })
  }
}
