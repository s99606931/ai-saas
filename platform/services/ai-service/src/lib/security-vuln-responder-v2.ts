// Design Ref: §R435 — AI기반 자동 보안 취약점 대응 v2
// Plan SC: SVC-AI-ADV-R435-SC01

export type VulnerabilityType = 'CVE' | 'MISCONFIG' | 'EXPOSED_SECRET' | 'INSECURE_DEPENDENCY' | 'WEAK_CIPHER' | 'OPEN_PORT'
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ResponseAction = 'PATCH' | 'BLOCK_PORT' | 'ROTATE_SECRET' | 'UPDATE_DEPENDENCY' | 'RECONFIGURE' | 'ESCALATE'

export interface Vulnerability {
  vulnId: string
  serviceId: string
  type: VulnerabilityType
  severity: Severity
  detail: string
  discoveredAt: number
  cveId?: string
}

export interface VulnResponse {
  vulnId: string
  serviceId: string
  actions: Array<{ action: ResponseAction; detail: string; automated: boolean }>
  priority: number        // 1 (긴급) ~ 5 (낮음)
  slaHours: number        // 대응 SLA 시간
  resolved: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  vulnId: string
  detail: Record<string, unknown>
}

export class SecurityVulnResponderV2 {
  private vulnerabilities = new Map<string, Vulnerability>()
  private responses = new Map<string, VulnResponse>()
  private auditLog: AuditEntry[] = []

  reportVuln(vuln: Vulnerability): void {
    this.vulnerabilities.set(vuln.vulnId, vuln)
    this.appendAudit('vuln.report', vuln.vulnId, { type: vuln.type, severity: vuln.severity, serviceId: vuln.serviceId })
  }

  respond(vulnId: string): VulnResponse {
    const vuln = this.vulnerabilities.get(vulnId)
    if (!vuln) throw new Error(`Unknown vulnerability: ${vulnId}`)

    this.appendAudit('vuln.respond', vulnId, { severity: vuln.severity, type: vuln.type })

    const actions: VulnResponse['actions'] = []

    // 취약점 유형별 대응 액션
    switch (vuln.type) {
      case 'CVE':
        actions.push({ action: 'PATCH', detail: `CVE ${vuln.cveId ?? vulnId} 패치 적용`, automated: vuln.severity !== 'CRITICAL' })
        break
      case 'EXPOSED_SECRET':
        actions.push({ action: 'ROTATE_SECRET', detail: '노출된 시크릿 즉시 교체', automated: true })
        actions.push({ action: 'BLOCK_PORT', detail: '접근 경로 일시 차단', automated: true })
        break
      case 'INSECURE_DEPENDENCY':
        actions.push({ action: 'UPDATE_DEPENDENCY', detail: '의존성 패키지 최신 보안 버전으로 업데이트', automated: false })
        break
      case 'MISCONFIG':
        actions.push({ action: 'RECONFIGURE', detail: '보안 설정 재구성', automated: false })
        break
      case 'OPEN_PORT':
        actions.push({ action: 'BLOCK_PORT', detail: '불필요 포트 차단', automated: true })
        break
      case 'WEAK_CIPHER':
        actions.push({ action: 'RECONFIGURE', detail: 'TLS 1.3+ 및 강력한 암호화 스위트 적용', automated: false })
        break
    }

    // CRITICAL/HIGH 추가 에스컬레이션
    if (vuln.severity === 'CRITICAL') {
      actions.push({ action: 'ESCALATE', detail: '보안팀 즉시 에스컬레이션', automated: true })
    }

    const priority =
      vuln.severity === 'CRITICAL' ? 1
        : vuln.severity === 'HIGH' ? 2
        : vuln.severity === 'MEDIUM' ? 3
        : vuln.severity === 'LOW' ? 4
        : 5

    const slaHours =
      vuln.severity === 'CRITICAL' ? 4
        : vuln.severity === 'HIGH' ? 24
        : vuln.severity === 'MEDIUM' ? 72
        : 168

    const response: VulnResponse = {
      vulnId, serviceId: vuln.serviceId, actions, priority, slaHours, resolved: false,
    }
    this.responses.set(vulnId, response)
    return response
  }

  resolve(vulnId: string): boolean {
    const response = this.responses.get(vulnId)
    if (!response) return false
    response.resolved = true
    this.appendAudit('vuln.resolve', vulnId, { serviceId: response.serviceId })
    return true
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, vulnId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, vulnId, detail })
  }
}
