// Design Ref: §클래스 설계 — UserBehaviorAnalyzerV2
// Plan SC: SVC-AI-ADV-R531

import { createHash } from 'crypto'

interface UserSession {
  sessionId: string
  userId: string
  serviceId: string
}

interface BehaviorEvent {
  sessionId: string
  eventType: string
  duration: number
}

interface AuditEntry {
  timestamp: string
  action: string
  sessionId: string
  maskedUserId?: string
  details?: Record<string, unknown>
}

export class UserBehaviorAnalyzerV2 {
  private sessions = new Map<string, UserSession>()
  private events: BehaviorEvent[] = []
  private auditLog: AuditEntry[] = []

  registerSession(sessionId: string, userId: string, serviceId: string): UserSession {
    const session: UserSession = { sessionId, userId, serviceId }
    this.sessions.set(sessionId, session)
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SESSION', sessionId, maskedUserId, details: { serviceId } })
    return session
  }

  recordEvent(sessionId: string, eventType: string, duration: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.sessions.has(sessionId)) throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`)
    this.events.push({ sessionId, eventType, duration })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_EVENT', sessionId, details: { eventType, duration } })
  }

  getEngagementScore(sessionId: string): number {
    const sessionEvents = this.events.filter(e => e.sessionId === sessionId)
    if (sessionEvents.length === 0) return 0
    const avgDuration = sessionEvents.reduce((s, e) => s + e.duration, 0) / sessionEvents.length
    return sessionEvents.length * avgDuration
  }

  getLowEngagementSessions(): UserSession[] {
    return Array.from(this.sessions.values()).filter(s => this.getEngagementScore(s.sessionId) < 10)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
