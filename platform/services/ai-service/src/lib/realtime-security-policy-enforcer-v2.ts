// Design Ref: §설계결정 — AI기반 실시간 보안 정책 강화 v2
// Plan SC: FR-R600.1~5

interface SecurityPolicy { policyId: string; name: string; ruleType: string; threshold: number }
interface PolicyEvent { eventId: string; policyId: string; value: number; blocked: boolean; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class RealtimeSecurityPolicyEnforcerV2 {
  private policies = new Map<string, SecurityPolicy>()
  private events = new Map<string, PolicyEvent>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policyId: string, name: string, ruleType: string, threshold: number): void {
    this.policies.set(policyId, { policyId, name, ruleType, threshold })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_POLICY', details: { policyId, name, ruleType, threshold } })
  }

  enforcePolicy(eventId: string, policyId: string, value: number, dataGrade?: string): boolean {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const policy = this.policies.get(policyId)
    const blocked = policy ? value > policy.threshold : false
    this.events.set(eventId, { eventId, policyId, value, blocked, timestamp: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'ENFORCE_POLICY', details: { eventId, policyId, value, blocked } })
    return blocked
  }

  getBlockedEvents(): PolicyEvent[] {
    return Array.from(this.events.values()).filter(e => e.blocked)
  }

  getBlockRate(): number {
    const total = this.events.size
    if (total === 0) return 0
    return (this.getBlockedEvents().length / total) * 100
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
