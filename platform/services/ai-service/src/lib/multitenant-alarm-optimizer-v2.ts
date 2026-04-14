// Design Ref: §클래스 설계 — MultitenantAlarmOptimizerV2
// Plan SC: SVC-AI-ADV-R534

interface AlarmRule {
  tenantId: string
  ruleId: string
  metric: string
  threshold: number
  severity: string
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  details?: Record<string, unknown>
}

export class MultitenantAlarmOptimizerV2 {
  private rules = new Map<string, AlarmRule>()
  private alarmCounts = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerRule(tenantId: string, ruleId: string, metric: string, threshold: number, severity: string): AlarmRule {
    const key = `${tenantId}:${ruleId}`
    const rule: AlarmRule = { tenantId, ruleId, metric, threshold, severity }
    this.rules.set(key, rule)
    this.alarmCounts.set(key, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_RULE', tenantId, details: { ruleId, metric, threshold, severity } })
    return rule
  }

  recordAlarm(tenantId: string, ruleId: string, value: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    const key = `${tenantId}:${ruleId}`
    if (!this.rules.has(key)) throw new Error(`규칙을 찾을 수 없습니다: ${key}`)
    this.alarmCounts.set(key, (this.alarmCounts.get(key) ?? 0) + 1)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ALARM', tenantId, details: { ruleId, value } })
  }

  getAlarmStats(tenantId: string): { ruleId: string; count: number }[] {
    const result: { ruleId: string; count: number }[] = []
    for (const [key, rule] of this.rules) {
      if (rule.tenantId === tenantId) {
        result.push({ ruleId: rule.ruleId, count: this.alarmCounts.get(key) ?? 0 })
      }
    }
    return result
  }

  getHighFrequencyRules(countThreshold: number): AlarmRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      const key = `${rule.tenantId}:${rule.ruleId}`
      return (this.alarmCounts.get(key) ?? 0) >= countThreshold
    })
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
