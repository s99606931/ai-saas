// Design Ref: §R590 — AI기반 서비스 API 보안 분류기 v2
// Plan SC: SVC-AI-ADV-R590-SC01

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type AuthType = 'NONE' | 'API_KEY' | 'JWT' | 'OAUTH2' | 'MTLS'
export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ApiEndpoint {
  endpointId: string
  serviceId: string
  path: string
  method: HttpMethod
  authType: AuthType
  requiresAdminRole: boolean
  returnsPii: boolean
  dataSensitivity: DataSensitivity
  rateLimit: number | null    // 분당 요청 수 제한 (null = 미설정)
  tlsRequired: boolean
}

export interface SecurityClassification {
  endpointId: string
  path: string
  method: HttpMethod
  riskLevel: RiskLevel
  findings: SecurityFinding[]
  securityControls: string[]
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL'
}

export interface SecurityFinding {
  findingId: string
  riskLevel: RiskLevel
  category: string
  detail: string
  remediation: string
}

export interface ApiSecurityReport {
  serviceId: string
  totalEndpoints: number
  criticalCount: number
  highCount: number
  compliantCount: number
  classifications: SecurityClassification[]
  overallRiskLevel: RiskLevel
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  detail: Record<string, unknown>
}

export class ApiSecurityClassifierV2 {
  private endpoints = new Map<string, ApiEndpoint>()
  private auditLog: AuditEntry[] = []

  registerEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.set(endpoint.endpointId, endpoint)
    this.appendAudit('endpoint.register', endpoint.endpointId, { path: endpoint.path, method: endpoint.method, authType: endpoint.authType })
  }

  classify(endpointId: string): SecurityClassification {
    const ep = this.endpoints.get(endpointId)
    if (!ep) throw new Error(`Unknown endpoint: ${endpointId}`)

    const findings: SecurityFinding[] = []
    this.checkAuthFindings(ep, findings)
    this.checkDataFindings(ep, findings)
    this.checkNetworkFindings(ep, findings)

    const criticalFindings = findings.filter((f) => f.riskLevel === 'CRITICAL').length
    const highFindings = findings.filter((f) => f.riskLevel === 'HIGH').length

    const riskLevel: RiskLevel =
      criticalFindings > 0 ? 'CRITICAL'
        : highFindings > 0 ? 'HIGH'
        : findings.length > 0 ? 'MEDIUM'
        : 'LOW'

    const securityControls = this.buildSecurityControls(ep)
    const complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' =
      criticalFindings > 0 ? 'NON_COMPLIANT'
        : findings.length > 0 ? 'PARTIAL'
        : 'COMPLIANT'

    this.appendAudit('endpoint.classify', endpointId, { riskLevel, findingCount: findings.length })
    return { endpointId, path: ep.path, method: ep.method, riskLevel, findings, securityControls, complianceStatus }
  }

  generateReport(serviceId: string): ApiSecurityReport {
    const serviceEndpoints = Array.from(this.endpoints.values()).filter((e) => e.serviceId === serviceId)
    const classifications = serviceEndpoints.map((e) => this.classify(e.endpointId))
    const criticalCount = classifications.filter((c) => c.riskLevel === 'CRITICAL').length
    const highCount = classifications.filter((c) => c.riskLevel === 'HIGH').length
    const compliantCount = classifications.filter((c) => c.complianceStatus === 'COMPLIANT').length

    const overallRiskLevel: RiskLevel =
      criticalCount > 0 ? 'CRITICAL'
        : highCount > 0 ? 'HIGH'
        : classifications.some((c) => c.riskLevel === 'MEDIUM') ? 'MEDIUM'
        : 'LOW'

    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL 엔드포인트 ${criticalCount}개 즉시 인증 적용 필요`)
    if (highCount > 0) recommendations.push(`HIGH 위험 엔드포인트 ${highCount}개 — 접근 통제 강화 필요`)

    this.appendAudit('report.generate', serviceId, { totalEndpoints: serviceEndpoints.length, criticalCount })
    return { serviceId, totalEndpoints: serviceEndpoints.length, criticalCount, highCount, compliantCount, classifications, overallRiskLevel, recommendations, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private checkAuthFindings(ep: ApiEndpoint, findings: SecurityFinding[]): void {
    if (ep.authType === 'NONE') {
      findings.push({ findingId: `FND-${ep.endpointId}-NOAUTH`, riskLevel: 'CRITICAL', category: '인증', detail: '인증 없는 엔드포인트 — 무단 접근 가능', remediation: 'JWT 또는 OAuth2 인증 즉시 적용 (CSAP D-08)' })
    }
    if (ep.requiresAdminRole && ep.authType === 'API_KEY') {
      findings.push({ findingId: `FND-${ep.endpointId}-WEAKAUTH`, riskLevel: 'HIGH', category: '인증', detail: '관리자 기능에 API 키 인증 사용 — 권한 상승 위험', remediation: 'RBAC 기반 OAuth2 또는 mTLS 적용' })
    }
  }

  private checkDataFindings(ep: ApiEndpoint, findings: SecurityFinding[]): void {
    if (ep.returnsPii) {
      findings.push({ findingId: `FND-${ep.endpointId}-PII`, riskLevel: 'HIGH', category: '데이터 보호', detail: '개인정보 반환 엔드포인트 — PII 마스킹 및 접근 제한 필요', remediation: '응답 데이터 PII 마스킹 적용 및 최소 권한 원칙 준수' })
    }
    if (ep.dataSensitivity === 'SECRET' || ep.dataSensitivity === 'CONFIDENTIAL') {
      if (ep.rateLimit === null) {
        findings.push({ findingId: `FND-${ep.endpointId}-NOLIMIT`, riskLevel: 'MEDIUM', category: '접근 제어', detail: '민감 데이터 엔드포인트에 요청 수 제한 없음', remediation: '분당 최대 요청 수 제한 적용 (Rate Limiting)' })
      }
    }
  }

  private checkNetworkFindings(ep: ApiEndpoint, findings: SecurityFinding[]): void {
    if (!ep.tlsRequired) {
      findings.push({ findingId: `FND-${ep.endpointId}-NOTLS`, riskLevel: 'HIGH', category: '전송 보안', detail: 'TLS 미적용 — 평문 전송 위험 (CSAP D-09)', remediation: 'TLS 1.3 적용 필수' })
    }
  }

  private buildSecurityControls(ep: ApiEndpoint): string[] {
    const controls: string[] = []
    if (ep.authType !== 'NONE') controls.push(`인증: ${ep.authType}`)
    if (ep.tlsRequired) controls.push('TLS 1.3+ 적용')
    if (ep.rateLimit !== null) controls.push(`요청 제한: ${ep.rateLimit}/분`)
    if (ep.requiresAdminRole) controls.push('관리자 권한 필요')
    return controls
  }

  private appendAudit(action: string, endpointId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, endpointId, detail })
  }
}
