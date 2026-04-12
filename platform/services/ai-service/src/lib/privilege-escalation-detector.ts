// Design Ref: §R192 — AI기반 동적 권한 승급 감지
// Plan SC: SVC-AI-ADV-R192-SC01
// CSAP D-08: 접근통제 — 권한 승급 이상 탐지

export type RoleLevel = 'VIEWER' | 'USER' | 'OPERATOR' | 'ADMIN' | 'SUPERADMIN'

const ROLE_RANK: Record<RoleLevel, number> = {
  VIEWER: 0,
  USER: 1,
  OPERATOR: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
}

export interface UserSession {
  userId: string
  currentRole: RoleLevel
  department: string
  lastLoginAt: string
}

export interface AccessEvent {
  eventId: string
  userId: string
  requestedRole: RoleLevel
  resource: string
  timestamp: string
  sourceIp: string
}

export type EscalationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

export interface EscalationResult {
  eventId: string
  userId: string
  escalationDetected: boolean
  levelJump: number
  severity: EscalationSeverity
  blocked: boolean
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  userId: string
  detail: Record<string, unknown>
}

export class PrivilegeEscalationDetector {
  private sessions = new Map<string, UserSession>()
  private auditLog: AuditEntry[] = []

  registerSession(session: UserSession): void {
    this.sessions.set(session.userId, session)
    this.appendAudit('session.register', session.userId, { role: session.currentRole })
  }

  detect(event: AccessEvent): EscalationResult {
    const session = this.sessions.get(event.userId)
    if (!session) throw new Error(`Unknown user: ${event.userId}`)

    const currentRank = ROLE_RANK[session.currentRole]
    const requestedRank = ROLE_RANK[event.requestedRole]
    const levelJump = requestedRank - currentRank

    let escalationDetected = false
    let severity: EscalationSeverity = 'NONE'
    let blocked = false
    let reason = '정상 접근'

    if (levelJump > 0) {
      escalationDetected = true
      if (levelJump >= 3) {
        severity = 'CRITICAL'
        blocked = true
        reason = `권한 ${levelJump}단계 급상승 — 자동 차단`
      } else if (levelJump >= 2) {
        severity = 'HIGH'
        blocked = true
        reason = `권한 ${levelJump}단계 상승 — 승인 필요`
      } else {
        severity = 'MEDIUM'
        blocked = false
        reason = `권한 ${levelJump}단계 상승 — 모니터링`
      }
    }

    this.appendAudit('escalation.detect', event.userId, {
      eventId: event.eventId,
      escalationDetected,
      severity,
      blocked,
      levelJump,
    })

    return { eventId: event.eventId, userId: event.userId, escalationDetected, levelJump, severity, blocked, reason }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, userId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, userId, detail })
  }
}
