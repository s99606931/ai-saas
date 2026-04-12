// Design Ref: §R235 — AI기반 자동 보안 감사 리포터
// Plan SC: SVC-AI-ADV-R235-SC01

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type FindingCategory = 'ACCESS_CONTROL' | 'ENCRYPTION' | 'AUDIT_LOG' | 'INPUT_VALIDATION' | 'CONFIGURATION'
export type ComplianceStandard = 'CSAP' | 'N2SF' | 'ISMS_P'

export interface AuditFinding {
  findingId: string
  category: FindingCategory
  severity: FindingSeverity
  title: string
  description: string
  affectedComponent: string
  remediation: string
}

export interface AuditScope {
  auditId: string
  targetSystem: string
  standards: ComplianceStandard[]
  auditedAt: string
}

export interface SecurityAuditReport {
  auditId: string
  targetSystem: string
  totalFindings: number
  bySeverity: Record<FindingSeverity, number>
  byCategory: Record<FindingCategory, number>
  complianceScore: number  // 0~100
  criticalIssues: AuditFinding[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  auditId: string
  detail: Record<string, unknown>
}

export class AutoSecurityAuditReporter {
  private scopes = new Map<string, AuditScope>()
  private findings = new Map<string, AuditFinding[]>()
  private auditLog: AuditEntry[] = []

  registerAudit(scope: AuditScope): void {
    this.scopes.set(scope.auditId, scope)
    this.findings.set(scope.auditId, [])
    this.appendAudit('audit.register', scope.auditId, { targetSystem: scope.targetSystem })
  }

  addFinding(auditId: string, finding: AuditFinding): void {
    if (!this.scopes.has(auditId)) throw new Error(`Unknown audit: ${auditId}`)
    const list = this.findings.get(auditId) ?? []
    list.push(finding)
    this.findings.set(auditId, list)
  }

  generateReport(auditId: string): SecurityAuditReport {
    const scope = this.scopes.get(auditId)
    if (!scope) throw new Error(`Unknown audit: ${auditId}`)

    const allFindings = this.findings.get(auditId) ?? []

    const bySeverity: Record<FindingSeverity, number> = {
      CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
    }
    const byCategory: Record<FindingCategory, number> = {
      ACCESS_CONTROL: 0, ENCRYPTION: 0, AUDIT_LOG: 0, INPUT_VALIDATION: 0, CONFIGURATION: 0,
    }

    for (const f of allFindings) {
      bySeverity[f.severity]++
      byCategory[f.category]++
    }

    // 점수: CRITICAL -20, HIGH -10, MEDIUM -5, LOW -2
    const deduction = bySeverity.CRITICAL * 20 + bySeverity.HIGH * 10 + bySeverity.MEDIUM * 5 + bySeverity.LOW * 2
    const complianceScore = Math.max(0, 100 - deduction)

    const criticalIssues = allFindings.filter((f) => f.severity === 'CRITICAL')

    const recommendations: string[] = []
    if (bySeverity.CRITICAL > 0) recommendations.push(`CRITICAL 발견사항 ${bySeverity.CRITICAL}건 즉시 조치 필요`)
    if (bySeverity.HIGH > 0) recommendations.push(`HIGH 발견사항 ${bySeverity.HIGH}건 30일 이내 조치`)
    if (byCategory.AUDIT_LOG > 0) recommendations.push('감사 로그 누락 항목 CSAP D-06 기준으로 보완')
    if (byCategory.ACCESS_CONTROL > 0) recommendations.push('접근 통제 취약점 CSAP D-08 기준으로 보완')
    if (recommendations.length === 0) recommendations.push('현재 보안 수준 양호 — 정기 감사 유지')

    this.appendAudit('audit.report', auditId, { totalFindings: allFindings.length, complianceScore })

    return {
      auditId,
      targetSystem: scope.targetSystem,
      totalFindings: allFindings.length,
      bySeverity,
      byCategory,
      complianceScore,
      criticalIssues,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, auditId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, auditId, detail })
  }
}
