// Design Ref: §R258 — AI기반 지능형 알림 필터링
// Plan SC: SVC-AI-ADV-R258-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertCategory = 'INFRASTRUCTURE' | 'SECURITY' | 'PERFORMANCE' | 'BUSINESS' | 'NOISE'
export type FilterAction = 'FORWARD' | 'SUPPRESS' | 'ESCALATE' | 'DEDUPLICATE'

export interface AlertRule {
  ruleId: string
  name: string
  category: AlertCategory
  minSeverityToForward: AlertSeverity
  suppressDuplicateWindowMs: number
  escalateAfterCount: number
}

export interface AlertEvent {
  alertId: string
  ruleId: string
  severity: AlertSeverity
  message: string
  timestamp: number
  source: string
}

export interface FilteredAlert {
  alertId: string
  ruleId: string
  action: FilterAction
  severity: AlertSeverity
  reason: string
  forwarded: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  ruleId: string
  detail: Record<string, unknown>
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

export class IntelligentAlertFilterAi {
  private rules = new Map<string, AlertRule>()
  private recentAlerts = new Map<string, AlertEvent[]>()  // ruleId → recent alerts
  private auditLog: AuditEntry[] = []

  registerRule(rule: AlertRule): void {
    this.rules.set(rule.ruleId, rule)
    this.recentAlerts.set(rule.ruleId, [])
    this.appendAudit('rule.register', rule.ruleId, { name: rule.name, category: rule.category })
  }

  filter(event: AlertEvent): FilteredAlert {
    const rule = this.rules.get(event.ruleId)
    if (!rule) throw new Error(`Unknown rule: ${event.ruleId}`)

    const history = this.recentAlerts.get(event.ruleId) ?? []
    history.push(event)
    this.recentAlerts.set(event.ruleId, history)

    const severityRank = SEVERITY_RANK[event.severity]
    const minRank = SEVERITY_RANK[rule.minSeverityToForward]

    // 중복 억제 윈도우 내 동일 메시지 탐지
    const windowStart = event.timestamp - rule.suppressDuplicateWindowMs
    const duplicates = history.filter(
      (e) => e.alertId !== event.alertId &&
        e.message === event.message &&
        e.timestamp >= windowStart
    )

    if (duplicates.length > 0) {
      this.appendAudit('alert.filter', event.ruleId, { action: 'DEDUPLICATE', alertId: event.alertId })
      return {
        alertId: event.alertId,
        ruleId: event.ruleId,
        action: 'DEDUPLICATE',
        severity: event.severity,
        reason: `중복 알림 억제 (${duplicates.length}건 동일 메시지)`,
        forwarded: false,
      }
    }

    // 심각도 미달 → 억제
    if (severityRank < minRank) {
      this.appendAudit('alert.filter', event.ruleId, { action: 'SUPPRESS', alertId: event.alertId })
      return {
        alertId: event.alertId,
        ruleId: event.ruleId,
        action: 'SUPPRESS',
        severity: event.severity,
        reason: `심각도 ${event.severity} — 전달 기준 ${rule.minSeverityToForward} 미달`,
        forwarded: false,
      }
    }

    // 에스컬레이션: 단기간 동일 룰 N회 초과
    const recentSameRule = history.filter(
      (e) => e.alertId !== event.alertId && e.timestamp >= windowStart
    )
    if (recentSameRule.length >= rule.escalateAfterCount) {
      this.appendAudit('alert.filter', event.ruleId, { action: 'ESCALATE', alertId: event.alertId })
      return {
        alertId: event.alertId,
        ruleId: event.ruleId,
        action: 'ESCALATE',
        severity: event.severity,
        reason: `${recentSameRule.length}회 반복 알림 — 에스컬레이션`,
        forwarded: true,
      }
    }

    // 정상 전달
    this.appendAudit('alert.filter', event.ruleId, { action: 'FORWARD', alertId: event.alertId })
    return {
      alertId: event.alertId,
      ruleId: event.ruleId,
      action: 'FORWARD',
      severity: event.severity,
      reason: '정상 전달',
      forwarded: true,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, ruleId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ruleId, detail })
  }
}
