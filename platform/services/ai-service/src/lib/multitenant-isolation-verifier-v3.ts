// Design Ref: §R464 — AI기반 멀티테넌트 격리 자동 검증 v3
// Plan SC: SVC-AI-ADV-R464-SC01

export type IsolationViolationType =
  | 'DATA_LEAK'
  | 'RESOURCE_SHARING'
  | 'NETWORK_BLEED'
  | 'CONFIG_EXPOSURE'
  | 'LOG_CONTAMINATION'

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IsolationStatus = 'COMPLIANT' | 'WARNING' | 'VIOLATED'

export interface TenantResource {
  resourceId: string
  tenantId: string
  resourceType: 'DATA' | 'COMPUTE' | 'NETWORK' | 'CONFIG' | 'LOG'
  isShared: boolean
  allowedTenants: string[]   // 공유 허용된 테넌트 목록
}

export interface IsolationViolation {
  violationId: string
  type: IsolationViolationType
  severity: ViolationSeverity
  sourceTenantId: string
  targetTenantId: string
  resourceId: string
  detail: string
}

export interface IsolationVerificationResult {
  tenantId: string
  status: IsolationStatus
  violations: IsolationViolation[]
  checkedResources: number
  complianceScore: number   // 0..100
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

export class MultitenantIsolationVerifierV3 {
  private resources = new Map<string, TenantResource>()
  private violationLog: IsolationViolation[] = []
  private auditLog: AuditEntry[] = []

  registerResource(resource: TenantResource): void {
    this.resources.set(resource.resourceId, resource)
    this.appendAudit('resource.register', resource.tenantId, { resourceId: resource.resourceId, type: resource.resourceType })
  }

  verify(tenantId: string): IsolationVerificationResult {
    this.appendAudit('isolation.verify', tenantId, {})

    const tenantResources = Array.from(this.resources.values()).filter((r) => r.tenantId === tenantId)
    const violations: IsolationViolation[] = []

    for (const resource of tenantResources) {
      // 공유 리소스인데 허용 목록 없음 → RESOURCE_SHARING 위반
      if (resource.isShared && resource.allowedTenants.length === 0) {
        const v: IsolationViolation = {
          violationId: `VIO-${resource.resourceId}-SHARE`,
          type: 'RESOURCE_SHARING',
          severity: resource.resourceType === 'DATA' ? 'CRITICAL' : 'HIGH',
          sourceTenantId: tenantId,
          targetTenantId: '*',
          resourceId: resource.resourceId,
          detail: `${resource.resourceType} 리소스 '${resource.resourceId}' 무허가 공유 상태`,
        }
        violations.push(v)
        this.violationLog.push(v)
      }
    }

    // 다른 테넌트의 리소스에서 이 테넌트가 허용 목록에 없이 접근 가능한지 확인
    const otherResources = Array.from(this.resources.values()).filter((r) => r.tenantId !== tenantId && r.isShared)
    for (const resource of otherResources) {
      if (!resource.allowedTenants.includes(tenantId) && resource.allowedTenants.length === 0) {
        // 무허가 공유 리소스 접근 가능
        const v: IsolationViolation = {
          violationId: `VIO-${resource.resourceId}-LEAK-${tenantId}`,
          type: 'DATA_LEAK',
          severity: resource.resourceType === 'DATA' ? 'CRITICAL' : 'HIGH',
          sourceTenantId: resource.tenantId,
          targetTenantId: tenantId,
          resourceId: resource.resourceId,
          detail: `타 테넌트(${resource.tenantId}) 리소스 '${resource.resourceId}' 잠재적 접근 가능`,
        }
        violations.push(v)
        this.violationLog.push(v)
      }
    }

    const criticalOrHigh = violations.filter((v) => v.severity === 'CRITICAL' || v.severity === 'HIGH').length
    const complianceScore = tenantResources.length > 0
      ? Math.max(0, Math.round(100 - (violations.length / Math.max(1, tenantResources.length)) * 100))
      : 100

    const status: IsolationStatus =
      criticalOrHigh > 0 ? 'VIOLATED'
        : violations.length > 0 ? 'WARNING'
        : 'COMPLIANT'

    this.appendAudit('isolation.result', tenantId, { violationCount: violations.length, status, complianceScore })

    return { tenantId, status, violations, checkedResources: tenantResources.length, complianceScore }
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
