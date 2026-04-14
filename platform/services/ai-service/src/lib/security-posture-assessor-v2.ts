// Design Ref: §설계결정 — AI기반 서비스 보안 태세 자동 평가 v2
// Plan SC: FR-R581.1~5

interface ServiceRecord { serviceId: string; name: string; tier: string }
interface CheckEntry { checkId: string; category: string; passed: boolean }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class SecurityPostureAssessorV2 {
  private services = new Map<string, ServiceRecord>()
  private checks = new Map<string, CheckEntry[]>()
  private auditLog: AuditEntry[] = []

  registerService(serviceId: string, name: string, tier: string): void {
    this.services.set(serviceId, { serviceId, name, tier })
    this.checks.set(serviceId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_SERVICE', details: { serviceId, name, tier } })
  }

  recordCheck(serviceId: string, checkId: string, category: string, passed: boolean, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.checks.get(serviceId) ?? []
    entries.push({ checkId, category, passed })
    this.checks.set(serviceId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_CHECK', details: { serviceId, checkId, passed } })
  }

  getSecurityScore(serviceId: string): number {
    const entries = this.checks.get(serviceId) ?? []
    if (entries.length === 0) return 100
    const passed = entries.filter(e => e.passed).length
    return (passed / entries.length) * 100
  }

  getVulnerableServices(): ServiceRecord[] {
    return Array.from(this.services.values()).filter(s => this.getSecurityScore(s.serviceId) < 70)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
