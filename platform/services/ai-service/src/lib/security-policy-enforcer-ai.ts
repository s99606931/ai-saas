// Design Ref: §R226 — AI기반 보안 정책 자동 적용
// Plan SC: SVC-AI-ADV-R226-SC01
// CSAP D-08: 접근 통제 정책 자동화

export type PolicyStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT'
export type EnforcementResult = 'ALLOWED' | 'BLOCKED' | 'WARNED'

export interface SecurityPolicy {
  policyId: string
  name: string
  status: PolicyStatus
  rules: PolicyRule[]
  priority: number
}

export interface PolicyRule {
  ruleId: string
  condition: 'IP_BLOCKED' | 'ROLE_REQUIRED' | 'TIME_RESTRICTION' | 'RATE_LIMIT'
  value: string
}

export interface AccessRequest {
  requestId: string
  userId: string
  sourceIp: string
  role: string
  resource: string
  timestamp: string
  requestCount?: number
}

export interface EnforcementDecision {
  requestId: string
  result: EnforcementResult
  matchedPolicies: string[]
  matchedRules: string[]
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

export class SecurityPolicyEnforcerAI {
  private policies = new Map<string, SecurityPolicy>()
  private blockedIps = new Set<string>()
  private auditLog: AuditEntry[] = []

  registerPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.policyId, policy)
    this.appendAudit('policy.register', policy.policyId, { name: policy.name, status: policy.status })
  }

  blockIp(ip: string): void {
    this.blockedIps.add(ip)
  }

  enforce(request: AccessRequest): EnforcementDecision {
    this.appendAudit('enforce.start', request.requestId, { userId: request.userId, resource: request.resource })

    const matchedPolicies: string[] = []
    const matchedRules: string[] = []
    let result: EnforcementResult = 'ALLOWED'
    let reason = '모든 정책 통과'

    const activePolicies = Array.from(this.policies.values())
      .filter((p) => p.status === 'ACTIVE')
      .sort((a, b) => a.priority - b.priority)

    for (const policy of activePolicies) {
      for (const rule of policy.rules) {
        if (rule.condition === 'IP_BLOCKED' && this.blockedIps.has(request.sourceIp)) {
          matchedPolicies.push(policy.policyId)
          matchedRules.push(rule.ruleId)
          result = 'BLOCKED'
          reason = `차단 IP: ${request.sourceIp}`
          break
        }
        if (rule.condition === 'ROLE_REQUIRED' && request.role !== rule.value) {
          matchedPolicies.push(policy.policyId)
          matchedRules.push(rule.ruleId)
          result = 'BLOCKED'
          reason = `권한 부족: ${rule.value} 필요`
          break
        }
        if (rule.condition === 'RATE_LIMIT') {
          const limit = parseInt(rule.value, 10)
          if ((request.requestCount ?? 0) > limit) {
            matchedPolicies.push(policy.policyId)
            matchedRules.push(rule.ruleId)
            result = 'WARNED'
            reason = `요청 속도 제한 초과: ${limit}req/min`
          }
        }
      }
      if (result === 'BLOCKED') break
    }

    this.appendAudit('enforce.decision', request.requestId, { result, matchedPolicies: matchedPolicies.length })

    return { requestId: request.requestId, result, matchedPolicies, matchedRules, reason }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
