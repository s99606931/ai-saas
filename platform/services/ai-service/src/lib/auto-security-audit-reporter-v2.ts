// Design Ref: §R487 — AI기반 실시간 보안 감사 보고 v2
// Plan SC: SVC-AI-ADV-R487-SC01

export type AuditEventType =
  | 'LOGIN_FAILURE' | 'PRIVILEGE_ESCALATION' | 'DATA_EXPORT'
  | 'CONFIG_CHANGE' | 'POLICY_VIOLATION' | 'UNUSUAL_ACCESS'
  | 'ACCOUNT_LOCKOUT' | 'PERMISSION_CHANGE'

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SecurityAuditEvent {
  eventId: string
  eventType: AuditEventType
  timestamp: number
  userId: string
  resourceId: string
  sourceIp: string
  detail: string
  dataGrade?: 'C' | 'S' | 'O'
}

export interface AuditFinding {
  findingId: string
  eventIds: string[]
  threatLevel: ThreatLevel
  pattern: string
  detail: string
  recommendation: string
}

export interface SecurityAuditReport {
  reportId: string
  periodStart: number
  periodEnd: number
  totalEvents: number
  findings: AuditFinding[]
  highRiskUsers: string[]    // CRITICAL/HIGH 이벤트 다수 발생 사용자
  overallThreatLevel: ThreatLevel
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  reportId: string
  detail: Record<string, unknown>
}

const EVENT_THREAT: Record<AuditEventType, ThreatLevel> = {
  LOGIN_FAILURE: 'LOW',
  UNUSUAL_ACCESS: 'MEDIUM',
  CONFIG_CHANGE: 'MEDIUM',
  DATA_EXPORT: 'HIGH',
  POLICY_VIOLATION: 'HIGH',
  PRIVILEGE_ESCALATION: 'CRITICAL',
  ACCOUNT_LOCKOUT: 'MEDIUM',
  PERMISSION_CHANGE: 'HIGH',
}

export class AutoSecurityAuditReporterV2 {
  private events: SecurityAuditEvent[] = []
  private auditLog: AuditEntry[] = []

  ingestEvent(event: SecurityAuditEvent): void {
    this.events.push(event)
    this.appendAudit('event.ingest', 'system', { eventId: event.eventId, eventType: event.eventType, userId: event.userId })
  }

  generateReport(periodStart: number, periodEnd: number): SecurityAuditReport {
    const reportId = `RPT-${periodStart}-${periodEnd}`
    this.appendAudit('report.generate', reportId, { periodStart, periodEnd })

    const periodEvents = this.events.filter((e) => e.timestamp >= periodStart && e.timestamp <= periodEnd)
    const findings: AuditFinding[] = []

    // 1. 반복 로그인 실패 탐지 (동일 사용자 5회 이상)
    const loginFailures = periodEvents.filter((e) => e.eventType === 'LOGIN_FAILURE')
    const loginFailuresByUser = new Map<string, SecurityAuditEvent[]>()
    for (const ev of loginFailures) {
      const list = loginFailuresByUser.get(ev.userId) ?? []
      list.push(ev)
      loginFailuresByUser.set(ev.userId, list)
    }
    for (const [userId, evs] of loginFailuresByUser.entries()) {
      if (evs.length >= 5) {
        findings.push({
          findingId: `FND-LOGIN-${userId}`,
          eventIds: evs.map((e) => e.eventId),
          threatLevel: 'HIGH',
          pattern: '반복 로그인 실패',
          detail: `사용자 ${userId} ${evs.length}회 로그인 실패 — 무차별 대입 공격 의심`,
          recommendation: '계정 잠금 정책 적용 및 MFA 강제 활성화',
        })
      }
    }

    // 2. 권한 상승 이벤트
    const privEsc = periodEvents.filter((e) => e.eventType === 'PRIVILEGE_ESCALATION')
    if (privEsc.length > 0) {
      findings.push({
        findingId: `FND-PRIVESC-${periodStart}`,
        eventIds: privEsc.map((e) => e.eventId),
        threatLevel: 'CRITICAL',
        pattern: '권한 상승',
        detail: `${privEsc.length}건 권한 상승 이벤트 탐지 — 즉시 검토 필요`,
        recommendation: '최소 권한 원칙(PoLP) 재검토 및 권한 감사 수행',
      })
    }

    // 3. C/S 등급 데이터 내보내기
    const dataExports = periodEvents.filter(
      (e) => e.eventType === 'DATA_EXPORT' && (e.dataGrade === 'C' || e.dataGrade === 'S'),
    )
    if (dataExports.length > 0) {
      findings.push({
        findingId: `FND-EXPORT-${periodStart}`,
        eventIds: dataExports.map((e) => e.eventId),
        threatLevel: 'CRITICAL',
        pattern: 'C/S 등급 데이터 내보내기',
        detail: `기밀/민감 등급 데이터 ${dataExports.length}건 내보내기 탐지 — N2SF N-05 위반`,
        recommendation: 'DLP 정책 강화 및 해당 사용자 권한 즉시 검토',
      })
    }

    // 고위험 사용자 산출
    const userThreatCount = new Map<string, number>()
    for (const ev of periodEvents) {
      const threat = EVENT_THREAT[ev.eventType]
      if (threat === 'CRITICAL' || threat === 'HIGH') {
        userThreatCount.set(ev.userId, (userThreatCount.get(ev.userId) ?? 0) + 1)
      }
    }
    const highRiskUsers = Array.from(userThreatCount.entries())
      .filter(([, count]) => count >= 3)
      .map(([userId]) => userId)

    const threatOrder: ThreatLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    const overallThreatLevel: ThreatLevel = findings.length === 0
      ? 'LOW'
      : threatOrder.find((t) => findings.some((f) => f.threatLevel === t)) ?? 'LOW'

    const report: SecurityAuditReport = {
      reportId,
      periodStart,
      periodEnd,
      totalEvents: periodEvents.length,
      findings,
      highRiskUsers,
      overallThreatLevel,
      generatedAt: new Date().toISOString(),
    }

    this.appendAudit('report.generated', reportId, { totalEvents: periodEvents.length, findingCount: findings.length, overallThreatLevel })
    return report
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, reportId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, reportId, detail })
  }
}
