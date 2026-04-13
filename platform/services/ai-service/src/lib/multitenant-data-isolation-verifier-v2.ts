// Design Ref: §R375 — AI기반 멀티테넌트 데이터 격리 검증 v2
// Plan SC: SVC-AI-ADV-R375-SC01

export type IsolationLevel = 'STRICT' | 'STANDARD' | 'RELAXED'
export type ViolationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface TenantConfig {
  tenantId: string
  name: string
  isolationLevel: IsolationLevel
  allowedResources: string[]  // 접근 허용 리소스 ID 목록
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'
}

export interface AccessAttempt {
  attemptId: string
  tenantId: string
  resourceId: string
  resourceOwnerId: string  // 리소스 소유 테넌트 ID
  operation: 'READ' | 'WRITE' | 'DELETE'
  timestamp: number
}

export interface IsolationViolation {
  attemptId: string
  tenantId: string
  resourceId: string
  severity: ViolationSeverity
  reason: string
}

export interface VerificationResult {
  allowed: boolean
  violations: IsolationViolation[]
  riskScore: number  // 0..100
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

export class MultitenantDataIsolationVerifierV2 {
  private tenants = new Map<string, TenantConfig>()
  private violationLog: IsolationViolation[] = []
  private auditLog: AuditEntry[] = []

  registerTenant(config: TenantConfig): void {
    this.tenants.set(config.tenantId, config)
    this.appendAudit('tenant.register', config.tenantId, { isolationLevel: config.isolationLevel })
  }

  verify(attempt: AccessAttempt): VerificationResult {
    const tenant = this.tenants.get(attempt.tenantId)
    if (!tenant) throw new Error(`Unknown tenant: ${attempt.tenantId}`)

    const violations: IsolationViolation[] = []
    let riskScore = 0

    // 핵심 격리 검사: 다른 테넌트 소유 리소스 접근
    const isCrossTenatAccess = attempt.resourceOwnerId !== attempt.tenantId

    if (isCrossTenatAccess) {
      // 허용된 리소스 목록에 포함되는지 확인
      const isAllowed = tenant.allowedResources.includes(attempt.resourceId)

      if (!isAllowed) {
        const severity: ViolationSeverity =
          attempt.operation === 'DELETE' ? 'CRITICAL'
            : attempt.operation === 'WRITE' ? 'HIGH'
            : tenant.isolationLevel === 'STRICT' ? 'HIGH'
            : 'MEDIUM'

        const violation: IsolationViolation = {
          attemptId: attempt.attemptId,
          tenantId: attempt.tenantId,
          resourceId: attempt.resourceId,
          severity,
          reason: `테넌트 ${attempt.tenantId}가 ${attempt.resourceOwnerId} 소유 리소스 ${attempt.operation} 시도 (격리 위반)`,
        }
        violations.push(violation)
        this.violationLog.push(violation)

        riskScore += severity === 'CRITICAL' ? 60 : severity === 'HIGH' ? 40 : 20
      }
    }

    // STRICT 격리 레벨: WRITE/DELETE는 소유 리소스만 허용
    if (tenant.isolationLevel === 'STRICT' && isCrossTenatAccess && (attempt.operation === 'WRITE' || attempt.operation === 'DELETE')) {
      if (!violations.some((v) => v.attemptId === attempt.attemptId)) {
        const violation: IsolationViolation = {
          attemptId: attempt.attemptId,
          tenantId: attempt.tenantId,
          resourceId: attempt.resourceId,
          severity: 'HIGH',
          reason: `STRICT 격리: ${attempt.operation} 작업은 타 테넌트 리소스에 불허`,
        }
        violations.push(violation)
        this.violationLog.push(violation)
        riskScore += 30
      }
    }

    // CONFIDENTIAL 데이터 테넌트의 외부 접근 차단
    if (tenant.dataClassification === 'CONFIDENTIAL' && isCrossTenatAccess) {
      riskScore += 10
    }

    riskScore = Math.min(100, riskScore)
    const allowed = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length === 0

    this.appendAudit('isolation.verify', attempt.tenantId, {
      attemptId: attempt.attemptId,
      allowed,
      violationCount: violations.length,
      riskScore,
    })

    return { allowed, violations, riskScore }
  }

  getViolationLog(): IsolationViolation[] {
    return [...this.violationLog]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
