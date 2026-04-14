// Design Ref: §설계결정 — AI기반 실시간 정책 엔진 v3
// Plan SC: FR-R635.1~5

interface Policy { policyId: string; predicate: (event: Record<string, unknown>) => boolean }
interface Violation { policyId: string; event: Record<string, unknown>; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class RealTimePolicyEngineV3 {
  private policies = new Map<string, Policy>()
  private violations: Violation[] = []
  private evalCounts = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policyId: string, predicate: Policy['predicate']): void {
    this.policies.set(policyId, { policyId, predicate })
    this.evalCounts.set(policyId, 0)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_POLICY', details: { policyId } })
  }

  evaluate(event: Record<string, unknown>, dataGrade?: string): Violation[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const newViolations: Violation[] = []
    for (const policy of this.policies.values()) {
      this.evalCounts.set(policy.policyId, (this.evalCounts.get(policy.policyId) ?? 0) + 1)
      if (!policy.predicate(event)) {
        const v = { policyId: policy.policyId, event, timestamp: new Date().toISOString() }
        this.violations.push(v)
        newViolations.push(v)
      }
    }
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'EVALUATE', details: { violations: newViolations.length } })
    return newViolations
  }

  getViolations(): Violation[] {
    return [...this.violations]
  }

  violationRate(policyId: string): number {
    const total = this.evalCounts.get(policyId) ?? 0
    if (total === 0) return 0
    const count = this.violations.filter(v => v.policyId === policyId).length
    return count / total
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
