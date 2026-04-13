// Design Ref: §핵심 알고리즘 — 컴플라이언스 점수, 정책 위반 탐지
// Plan SC: SVC-AI-ADV-R348
export type DataGrade = 'O' | 'C' | 'S'
export type PolicySeverity = 'critical' | 'high' | 'medium' | 'low'

const VIOLATION_DEDUCTION: Record<PolicySeverity, number> = { critical: 25, high: 15, medium: 8, low: 3 }

export interface CloudInstance {
  id: string
  name: string
  provider: string
}

export interface CloudPolicy {
  id: string
  name: string
  ruleType: string
  severity: PolicySeverity
  limit: number
}

export interface PolicyViolation {
  policyId: string
  ruleType: string
  severity: PolicySeverity
  value: number
  limit: number
}

export interface PolicyEvalResult {
  cloudId: string
  resourceType: string
  value: number
  violations: PolicyViolation[]
  complianceScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MulticloudPolicyEnforcerAI {
  private clouds = new Map<string, CloudInstance>()
  private policies = new Map<string, CloudPolicy>()
  private evalHistory = new Map<string, PolicyEvalResult[]>()
  private auditLog: AuditEntry[] = []

  registerCloud(id: string, name: string, provider: string): void {
    if (!id || !name || !provider) throw new Error('id, name, provider는 필수')
    this.clouds.set(id, { id, name, provider })
    this.evalHistory.set(id, [])
    this.auditLog.push({ action: 'cloud.register', timestamp: new Date().toISOString(), detail: `${provider}:${id}` })
  }

  registerPolicy(id: string, name: string, ruleType: string, severity: PolicySeverity, limit: number): void {
    if (!id || !name || !ruleType) throw new Error('id, name, ruleType은 필수')
    this.policies.set(id, { id, name, ruleType, severity, limit })
    this.auditLog.push({ action: 'policy.register', timestamp: new Date().toISOString(), detail: id })
  }

  evaluateResource(cloudId: string, resourceType: string, value: number, grade: DataGrade = 'O'): PolicyEvalResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 클라우드 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.clouds.has(cloudId)) throw new Error(`cloudId 없음: ${cloudId}`)
    const violations: PolicyViolation[] = []
    for (const policy of this.policies.values()) {
      if (policy.ruleType === resourceType && value > policy.limit) {
        violations.push({ policyId: policy.id, ruleType: policy.ruleType, severity: policy.severity, value, limit: policy.limit })
      }
    }
    const totalDeduction = violations.reduce((s, v) => s + VIOLATION_DEDUCTION[v.severity], 0)
    const complianceScore = Math.max(0, 100 - totalDeduction)
    const result: PolicyEvalResult = { cloudId, resourceType, value, violations, complianceScore }
    this.evalHistory.get(cloudId)!.push(result)
    this.auditLog.push({ action: 'resource.evaluate', timestamp: new Date().toISOString(), detail: `${cloudId}:${resourceType}=${value}` })
    return result
  }

  getComplianceScore(cloudId: string): number {
    if (!this.clouds.has(cloudId)) throw new Error(`cloudId 없음: ${cloudId}`)
    const history = this.evalHistory.get(cloudId) ?? []
    if (history.length === 0) return 100
    return Math.round(history.reduce((s, r) => s + r.complianceScore, 0) / history.length)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
