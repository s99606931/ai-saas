// Design Ref: §R298 — AI기반 보안 컴플라이언스 자동 교정
// Plan SC: SC-R298

export interface ComplianceViolation {
  violationId: string
  ruleId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  resourceId: string
  autoFixable: boolean
}

export interface CorrectionResult {
  violationId: string
  status: 'FIXED' | 'PENDING_MANUAL' | 'FAILED'
  action: string
  appliedAt: string
}

export interface CorrectionReport {
  totalViolations: number
  fixedCount: number
  pendingManualCount: number
  failedCount: number
  results: CorrectionResult[]
  overallComplianceScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const AUTO_FIX_ACTIONS: Record<string, string> = {
  'OPEN_PORT': '불필요 포트 자동 차단',
  'WEAK_TLS': 'TLS 1.3으로 자동 업그레이드',
  'NO_MFA': 'MFA 정책 자동 활성화',
  'EXCESSIVE_PERMISSION': '최소 권한 원칙 자동 적용 (CSAP D-08)',
  'UNENCRYPTED_STORAGE': 'AES-256 암호화 자동 활성화 (CSAP D-09)',
}

export class SecurityComplianceAutoCorrector {
  private violations = new Map<string, ComplianceViolation>()
  private auditLog: AuditEntry[] = []

  registerViolation(violation: ComplianceViolation): void {
    this.violations.set(violation.violationId, violation)
    this.auditLog.push({ action: 'violation.register', timestamp: new Date().toISOString(), detail: violation.violationId })
  }

  correct(violationIds?: string[]): CorrectionReport {
    const targets = violationIds
      ? violationIds.map((id) => {
          const v = this.violations.get(id)
          if (!v) throw new Error(`Violation not found: ${id}`)
          return v
        })
      : Array.from(this.violations.values())

    const results: CorrectionResult[] = []

    for (const violation of targets) {
      const fixAction = AUTO_FIX_ACTIONS[violation.ruleId]
      let status: CorrectionResult['status']
      let action: string

      if (violation.autoFixable && fixAction) {
        status = 'FIXED'
        action = fixAction
      } else if (!violation.autoFixable) {
        status = 'PENDING_MANUAL'
        action = `수동 교정 필요: ${violation.description}`
      } else {
        status = 'FAILED'
        action = '자동 교정 규칙 없음'
      }

      results.push({ violationId: violation.violationId, status, action, appliedAt: new Date().toISOString() })
    }

    const fixedCount = results.filter((r) => r.status === 'FIXED').length
    const pendingManualCount = results.filter((r) => r.status === 'PENDING_MANUAL').length
    const failedCount = results.filter((r) => r.status === 'FAILED').length
    const totalViolations = results.length

    // 심각도별 감점
    let deduction = 0
    for (const violation of targets) {
      const result = results.find((r) => r.violationId === violation.violationId)
      if (result?.status !== 'FIXED') {
        if (violation.severity === 'CRITICAL') deduction += 25
        else if (violation.severity === 'HIGH') deduction += 15
        else if (violation.severity === 'MEDIUM') deduction += 8
        else deduction += 3
      }
    }
    const overallComplianceScore = Math.max(0, 100 - deduction)

    this.auditLog.push({ action: 'compliance.correct', timestamp: new Date().toISOString(), detail: `fixed=${fixedCount}` })
    return { totalViolations, fixedCount, pendingManualCount, failedCount, results, overallComplianceScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
