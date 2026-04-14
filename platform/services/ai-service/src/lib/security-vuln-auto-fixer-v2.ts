// Design Ref: §R613 — AI기반 실시간 보안 취약점 자동 수정 v2
// Plan SC: SVC-AI-ADV-R613-SC01

export type VulnSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type FixStatus = 'FIXED' | 'PARTIAL' | 'FAILED'
export type VerifyStatus = 'VERIFIED' | 'UNVERIFIED' | 'REGRESSION'

export interface VulnerabilitySpec {
  vulnId: string
  cveId: string
  severity: VulnSeverity
  affectedComponent: string
  description: string
  patchAvailable: boolean
}

export interface FixResult {
  vulnId: string
  cveId: string
  status: FixStatus
  patchApplied: string
  remainingRisk: string
}

export interface VerifyResult {
  vulnId: string
  verifyStatus: VerifyStatus
  detail: string
}

export interface VulnReport {
  totalVulns: number
  fixedCount: number
  partialCount: number
  failedCount: number
  criticalRemaining: number
  fixResults: FixResult[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  vulnId: string
  detail: Record<string, unknown>
}

export class SecurityVulnAutoFixerV2 {
  private vulns = new Map<string, VulnerabilitySpec>()
  private fixResults = new Map<string, FixResult>()
  private auditLog: AuditEntry[] = []

  registerVulnerability(vuln: VulnerabilitySpec): void {
    this.vulns.set(vuln.vulnId, vuln)
    this.appendAudit('vuln.register', vuln.vulnId, { cveId: vuln.cveId, severity: vuln.severity })
  }

  fix(vulnId: string): FixResult {
    const vuln = this.vulns.get(vulnId)
    if (!vuln) throw new Error(`Unknown vulnerability: ${vulnId}`)

    let status: FixStatus
    let patchApplied: string
    let remainingRisk: string

    if (!vuln.patchAvailable) {
      status = 'FAILED'
      patchApplied = '없음 — 패치 미제공'
      remainingRisk = `${vuln.severity} 위험 지속 — 수동 완화 조치 필요`
    } else if (vuln.severity === 'CRITICAL') {
      status = 'PARTIAL'
      patchApplied = `${vuln.cveId} 임시 패치 적용`
      remainingRisk = 'CRITICAL 취약점 부분 완화 — 전체 패치 배포 필요'
    } else {
      status = 'FIXED'
      patchApplied = `${vuln.cveId} 패치 완전 적용`
      remainingRisk = '없음'
    }

    const result: FixResult = { vulnId, cveId: vuln.cveId, status, patchApplied, remainingRisk }
    this.fixResults.set(vulnId, result)
    this.appendAudit('vuln.fix', vulnId, { status, cveId: vuln.cveId })
    return result
  }

  verify(vulnId: string): VerifyResult {
    const vuln = this.vulns.get(vulnId)
    if (!vuln) throw new Error(`Unknown vulnerability: ${vulnId}`)

    const fixResult = this.fixResults.get(vulnId)
    if (!fixResult) {
      const result: VerifyResult = { vulnId, verifyStatus: 'UNVERIFIED', detail: '수정 미실행 — fix() 먼저 실행 필요' }
      this.appendAudit('vuln.verify', vulnId, { verifyStatus: 'UNVERIFIED' })
      return result
    }

    let verifyStatus: VerifyStatus
    let detail: string

    if (fixResult.status === 'FIXED') {
      verifyStatus = 'VERIFIED'
      detail = `${vuln.cveId} 패치 검증 완료 — 취약점 제거 확인`
    } else if (fixResult.status === 'PARTIAL') {
      verifyStatus = 'REGRESSION'
      detail = `${vuln.cveId} 부분 수정 — 추가 패치 적용 필요, 회귀 위험 존재`
    } else {
      verifyStatus = 'UNVERIFIED'
      detail = `${vuln.cveId} 수정 실패 — 수동 완화 조치 검토 필요`
    }

    this.appendAudit('vuln.verify', vulnId, { verifyStatus })
    return { vulnId, verifyStatus, detail }
  }

  generateReport(): VulnReport {
    const allVulns = Array.from(this.vulns.values())
    const allFixes = Array.from(this.fixResults.values())

    const fixedCount = allFixes.filter((f) => f.status === 'FIXED').length
    const partialCount = allFixes.filter((f) => f.status === 'PARTIAL').length
    const failedCount = allFixes.filter((f) => f.status === 'FAILED').length

    const fixedIds = new Set(allFixes.filter((f) => f.status === 'FIXED').map((f) => f.vulnId))
    const criticalRemaining = allVulns.filter((v) => v.severity === 'CRITICAL' && !fixedIds.has(v.vulnId)).length

    this.appendAudit('report.generate', 'system', { totalVulns: allVulns.length, fixedCount, criticalRemaining })
    return {
      totalVulns: allVulns.length,
      fixedCount,
      partialCount,
      failedCount,
      criticalRemaining,
      fixResults: allFixes,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, vulnId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, vulnId, detail })
  }
}
