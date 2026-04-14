// Design Ref: §클래스 설계 — CyberSecurityAutomatorV2
// Plan SC: SVC-AI-ADV-R551

interface SecurityPolicy {
  policyId: string
  name: string
  category: string
  severity: string
}

interface AuditEntry { timestamp: string; action: string; policyId: string; details?: Record<string, unknown> }

export class CyberSecurityAutomatorV2 {
  private policies = new Map<string, SecurityPolicy>()
  private eventCounts = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policyId: string, name: string, category: string, severity: string): SecurityPolicy {
    const policy: SecurityPolicy = { policyId, name, category, severity }
    this.policies.set(policyId, policy)
    this.eventCounts.set(policyId, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_POLICY', policyId, details: { name, category, severity } })
    return policy
  }

  recordEvent(policyId: string, eventType: string, source: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.policies.has(policyId)) throw new Error(`정책을 찾을 수 없습니다: ${policyId}`)
    this.eventCounts.set(policyId, (this.eventCounts.get(policyId) ?? 0) + 1)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_EVENT', policyId, details: { eventType, source } })
  }

  getEventCount(policyId: string): number {
    return this.eventCounts.get(policyId) ?? 0
  }

  getHighSeverityPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.severity === 'high')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
