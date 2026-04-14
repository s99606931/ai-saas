// Design Ref: §R491 — AI기반 자동 서비스 메시 보안 v2
// Plan SC: SVC-AI-ADV-R491-SC01

export type MeshSecurityIssueType =
  | 'UNENCRYPTED_TRAFFIC' | 'MISSING_MTLS' | 'OPEN_EGRESS'
  | 'POLICY_MISMATCH' | 'CERT_EXPIRY' | 'EXCESSIVE_PERMISSIONS'

export type MeshPolicyStatus = 'COMPLIANT' | 'WARNING' | 'VIOLATION'

export interface MeshService {
  serviceId: string
  name: string
  namespace: string
  mtlsEnabled: boolean
  egressRules: string[]      // 허용 대상 서비스 ID 목록
  certExpiryDaysRemaining: number
  ingressPolicies: string[]  // 허용 인바운드 정책 목록
}

export interface MeshSecurityIssue {
  issueId: string
  serviceId: string
  type: MeshSecurityIssueType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail: string
  remediation: string
}

export interface MeshSecurityReport {
  totalServices: number
  issues: MeshSecurityIssue[]
  nonCompliantServices: string[]
  overallStatus: MeshPolicyStatus
  complianceScore: number   // 0..100
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceMeshSecurityAIV2 {
  private services = new Map<string, MeshService>()
  private auditLog: AuditEntry[] = []

  registerService(service: MeshService): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, namespace: service.namespace })
  }

  analyze(): MeshSecurityReport {
    const allServices = Array.from(this.services.values())
    this.appendAudit('mesh.analyze', 'system', { serviceCount: allServices.length })

    const issues: MeshSecurityIssue[] = []
    const nonCompliantServices: string[] = []

    for (const svc of allServices) {
      const svcIssues: MeshSecurityIssue[] = []

      // mTLS 미적용
      if (!svc.mtlsEnabled) {
        svcIssues.push({
          issueId: `ISS-MTLS-${svc.serviceId}`,
          serviceId: svc.serviceId,
          type: 'MISSING_MTLS',
          severity: 'CRITICAL',
          detail: `'${svc.name}' mTLS 비활성화 — 평문 서비스 간 통신`,
          remediation: 'Istio/Linkerd PeerAuthentication에서 STRICT mTLS 설정',
        })
      }

      // 인증서 만료 임박 (30일 이하)
      if (svc.certExpiryDaysRemaining <= 30 && svc.certExpiryDaysRemaining > 0) {
        svcIssues.push({
          issueId: `ISS-CERT-${svc.serviceId}`,
          serviceId: svc.serviceId,
          type: 'CERT_EXPIRY',
          severity: svc.certExpiryDaysRemaining <= 7 ? 'CRITICAL' : 'HIGH',
          detail: `'${svc.name}' 인증서 ${svc.certExpiryDaysRemaining}일 후 만료`,
          remediation: 'cert-manager 자동 갱신 확인 또는 수동 갱신 즉시 진행',
        })
      }

      // 개방형 egress (빈 규칙 = 모든 외부 통신 허용)
      if (svc.egressRules.length === 0 && svc.ingressPolicies.length > 0) {
        svcIssues.push({
          issueId: `ISS-EGRESS-${svc.serviceId}`,
          serviceId: svc.serviceId,
          type: 'OPEN_EGRESS',
          severity: 'HIGH',
          detail: `'${svc.name}' 이그레스 규칙 없음 — 모든 외부 통신 허용`,
          remediation: 'NetworkPolicy 또는 AuthorizationPolicy로 필요한 이그레스만 허용',
        })
      }

      // 과도한 수신 정책 (인바운드 정책 10개 이상)
      if (svc.ingressPolicies.length >= 10) {
        svcIssues.push({
          issueId: `ISS-PERM-${svc.serviceId}`,
          serviceId: svc.serviceId,
          type: 'EXCESSIVE_PERMISSIONS',
          severity: 'MEDIUM',
          detail: `'${svc.name}' 인바운드 정책 ${svc.ingressPolicies.length}개 — 과도한 접근 허용`,
          remediation: '최소 권한 원칙 기반 정책 재검토 및 불필요한 규칙 제거',
        })
      }

      if (svcIssues.length > 0) {
        nonCompliantServices.push(svc.serviceId)
        issues.push(...svcIssues)
      }
    }

    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
    const highCount = issues.filter((i) => i.severity === 'HIGH').length
    const overallStatus: MeshPolicyStatus =
      criticalCount > 0 ? 'VIOLATION'
        : highCount > 0 ? 'WARNING'
        : 'COMPLIANT'

    const complianceScore = allServices.length > 0
      ? Math.max(0, Math.round(100 - (nonCompliantServices.length / allServices.length) * 100))
      : 100

    const recommendations: string[] = []
    if (criticalCount > 0) {
      recommendations.push(`CRITICAL 이슈 ${criticalCount}건 즉시 조치 필요`)
    }
    if (allServices.some((s) => !s.mtlsEnabled)) {
      recommendations.push('전 서비스 mTLS STRICT 모드 적용 우선 추진')
    }

    return { totalServices: allServices.length, issues, nonCompliantServices, overallStatus, complianceScore, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
