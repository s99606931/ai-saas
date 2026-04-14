// Design Ref: §설계결정 — AI기반 자동 보안 규정 준수 교정 v2
// Plan SC: FR-R596.1~5

interface ComplianceRule { ruleId: string; name: string; category: string; severity: string }
interface ViolationRecord { violationId: string; ruleId: string; resourceId: string; corrected: boolean }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class SecurityComplianceCorrectorV2 {
  private rules = new Map<string, ComplianceRule>()
  private violations = new Map<string, ViolationRecord>()
  private auditLog: AuditEntry[] = []

  registerRule(ruleId: string, name: string, category: string, severity: string): void {
    this.rules.set(ruleId, { ruleId, name, category, severity })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_RULE', details: { ruleId, name } })
  }

  recordViolation(violationId: string, ruleId: string, resourceId: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.violations.set(violationId, { violationId, ruleId, resourceId, corrected: false })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_VIOLATION', details: { violationId, ruleId, resourceId } })
  }

  markCorrected(violationId: string): void {
    const v = this.violations.get(violationId)
    if (v) this.violations.set(violationId, { ...v, corrected: true })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'MARK_CORRECTED', details: { violationId } })
  }

  getUncorrectedViolations(): ViolationRecord[] {
    return Array.from(this.violations.values()).filter(v => !v.corrected)
  }

  getCorrectionRate(): number {
    const total = this.violations.size
    if (total === 0) return 100
    const corrected = Array.from(this.violations.values()).filter(v => v.corrected).length
    return (corrected / total) * 100
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
