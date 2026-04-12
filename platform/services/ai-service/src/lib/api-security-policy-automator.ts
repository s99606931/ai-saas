// Design Ref: §R257 — AI기반 API 보안 정책 자동화
// Plan SC: SVC-AI-ADV-R257-SC01
// CSAP D-08: 접근 통제, D-06: 감사 로그, D-12: 입력 검증

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type PolicyAction = 'ALLOW' | 'DENY' | 'RATE_LIMIT' | 'REQUIRE_AUTH' | 'REQUIRE_ADMIN'
export type ViolationType = 'NO_AUTH' | 'NO_RATE_LIMIT' | 'PUBLIC_WRITE' | 'ADMIN_UNPROTECTED' | 'SENSITIVE_EXPOSED'

export interface ApiEndpoint {
  endpointId: string
  path: string
  method: HttpMethod
  requiresAuth: boolean
  rateLimitPerMin: number
  isAdminOnly: boolean
  exposesSensitiveData: boolean
}

export interface PolicyViolation {
  endpointId: string
  violationType: ViolationType
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  description: string
  suggestedPolicy: PolicyAction
}

export interface SecurityPolicyReport {
  endpointId: string
  violations: PolicyViolation[]
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  autoAppliedPolicies: PolicyAction[]
  recommendation: string
}

interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  detail: Record<string, unknown>
}

export class ApiSecurityPolicyAutomator {
  private endpoints = new Map<string, ApiEndpoint>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.set(endpoint.endpointId, endpoint)
    this.appendAudit('endpoint.register', endpoint.endpointId, { path: endpoint.path, method: endpoint.method })
  }

  audit(endpointId: string): SecurityPolicyReport {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) throw new Error(`Unknown endpoint: ${endpointId}`)

    const violations: PolicyViolation[] = []
    const autoAppliedPolicies: PolicyAction[] = []

    // 인증 없는 엔드포인트
    if (!endpoint.requiresAuth) {
      if (endpoint.method !== 'GET' || endpoint.exposesSensitiveData) {
        violations.push({
          endpointId,
          violationType: 'NO_AUTH',
          severity: 'CRITICAL',
          description: `${endpoint.method} ${endpoint.path} — 인증 없음`,
          suggestedPolicy: 'REQUIRE_AUTH',
        })
        autoAppliedPolicies.push('REQUIRE_AUTH')
      }
    }

    // 속도 제한 없음
    if (endpoint.rateLimitPerMin <= 0) {
      violations.push({
        endpointId,
        violationType: 'NO_RATE_LIMIT',
        severity: 'HIGH',
        description: `${endpoint.path} — Rate Limit 미설정`,
        suggestedPolicy: 'RATE_LIMIT',
      })
      autoAppliedPolicies.push('RATE_LIMIT')
    }

    // 인증 없는 쓰기 작업
    if (!endpoint.requiresAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method)) {
      violations.push({
        endpointId,
        violationType: 'PUBLIC_WRITE',
        severity: 'CRITICAL',
        description: `공개 쓰기 엔드포인트 ${endpoint.method} ${endpoint.path}`,
        suggestedPolicy: 'REQUIRE_AUTH',
      })
    }

    // 관리자 엔드포인트 보호 부재
    if (endpoint.isAdminOnly && !endpoint.requiresAuth) {
      violations.push({
        endpointId,
        violationType: 'ADMIN_UNPROTECTED',
        severity: 'CRITICAL',
        description: `관리자 엔드포인트 ${endpoint.path} 인증 미적용`,
        suggestedPolicy: 'REQUIRE_ADMIN',
      })
      autoAppliedPolicies.push('REQUIRE_ADMIN')
    }

    // 민감 데이터 공개 노출
    if (endpoint.exposesSensitiveData && !endpoint.requiresAuth) {
      violations.push({
        endpointId,
        violationType: 'SENSITIVE_EXPOSED',
        severity: 'CRITICAL',
        description: `민감 데이터 미인증 노출 ${endpoint.path}`,
        suggestedPolicy: 'REQUIRE_AUTH',
      })
    }

    const hasCritical = violations.some((v) => v.severity === 'CRITICAL')
    const hasHigh = violations.some((v) => v.severity === 'HIGH')
    const overallRisk =
      hasCritical ? 'CRITICAL' :
      hasHigh ? 'HIGH' :
      violations.length > 0 ? 'MEDIUM' : 'LOW'

    const recommendation =
      overallRisk === 'CRITICAL' ? '즉시 보안 정책 적용 필요 — 서비스 차단 검토' :
      overallRisk === 'HIGH' ? '24시간 내 정책 보강 필요' :
      overallRisk === 'MEDIUM' ? '정기 점검 주기에 보완 권고' :
      '보안 정책 적절히 설정됨'

    this.appendAudit('endpoint.audit', endpointId, { overallRisk, violationCount: violations.length })

    return { endpointId, violations, overallRisk, autoAppliedPolicies, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, endpointId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, endpointId, detail })
  }
}
