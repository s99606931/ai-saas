// Design Ref: §R528 — AI기반 공공기관 내부 감사 자동화 v2
// Plan SC: SVC-AI-ADV-R528-SC01

export type AuditDomain = 'IT_SECURITY' | 'FINANCIAL' | 'OPERATIONS' | 'COMPLIANCE' | 'HR' | 'PROCUREMENT'
export type ControlStatus = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'NOT_TESTED'
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface AuditControl {
  controlId: string
  domain: AuditDomain
  name: string
  description: string
  status: ControlStatus
  lastTestedDaysAgo: number
  automationLevel: number   // 0..100 (자동화 비율 %)
  evidenceCount: number
}

export interface InternalAuditFinding {
  findingId: string
  controlId: string
  domain: AuditDomain
  riskRating: RiskRating
  title: string
  detail: string
  managementResponse: string
  targetRemediationDate: string
  evidenceRequired: string[]
}

export interface InternalAuditReport {
  auditId: string
  domain: AuditDomain
  totalControls: number
  effectiveControls: number
  findings: InternalAuditFinding[]
  overallRiskRating: RiskRating
  automationCoverage: number   // 0..100 (자동화 테스트 비율)
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  controlId: string
  detail: Record<string, unknown>
}

export class InternalAuditAutomatorV2 {
  private controls = new Map<string, AuditControl>()
  private auditLog: AuditEntry[] = []

  registerControl(control: AuditControl): void {
    this.controls.set(control.controlId, control)
    this.appendAudit('control.register', control.controlId, { domain: control.domain, name: control.name })
  }

  runAudit(domain: AuditDomain): InternalAuditReport {
    const auditId = `AUD-${domain}-${Date.now()}`
    this.appendAudit('audit.run', auditId, { domain })

    const domainControls = Array.from(this.controls.values()).filter((c) => c.domain === domain)
    const findings: InternalAuditFinding[] = []

    for (const control of domainControls) {
      // 비효과적 통제 → FINDING 생성
      if (control.status === 'INEFFECTIVE') {
        const riskRating: RiskRating = control.lastTestedDaysAgo > 365 ? 'CRITICAL' : 'HIGH'
        findings.push({
          findingId: `FND-${control.controlId}-INEFF`,
          controlId: control.controlId,
          domain,
          riskRating,
          title: `'${control.name}' 통제 비효과 판정`,
          detail: `통제 항목이 설계 목적대로 운영되지 않음. 마지막 테스트: ${control.lastTestedDaysAgo}일 전`,
          managementResponse: '시정 조치 계획 수립 예정',
          targetRemediationDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
          evidenceRequired: ['통제 개선 계획서', '재테스트 결과'],
        })
      }

      // 장기 미테스트 통제 → WARNING FINDING
      if (control.status !== 'INEFFECTIVE' && control.lastTestedDaysAgo > 365) {
        findings.push({
          findingId: `FND-${control.controlId}-UNTEST`,
          controlId: control.controlId,
          domain,
          riskRating: 'MEDIUM',
          title: `'${control.name}' 1년 이상 미테스트`,
          detail: `통제 효과성 테스트 ${control.lastTestedDaysAgo}일 미실시`,
          managementResponse: '연간 테스트 일정 수립 예정',
          targetRemediationDate: new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10),
          evidenceRequired: ['테스트 계획서', '테스트 결과 문서'],
        })
      }

      // 증거 없는 통제 → LOW FINDING
      if (control.evidenceCount === 0) {
        findings.push({
          findingId: `FND-${control.controlId}-NOEVID`,
          controlId: control.controlId,
          domain,
          riskRating: 'LOW',
          title: `'${control.name}' 증거 미수집`,
          detail: '통제 운영 증거 문서가 없음',
          managementResponse: '증거 수집 절차 수립',
          targetRemediationDate: new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10),
          evidenceRequired: ['운영 증거 문서'],
        })
      }
    }

    const effectiveControls = domainControls.filter((c) => c.status === 'EFFECTIVE').length
    const totalAutomation = domainControls.length > 0
      ? domainControls.reduce((s, c) => s + c.automationLevel, 0) / domainControls.length
      : 0

    const criticalCount = findings.filter((f) => f.riskRating === 'CRITICAL').length
    const highCount = findings.filter((f) => f.riskRating === 'HIGH').length
    const overallRiskRating: RiskRating =
      criticalCount > 0 ? 'CRITICAL'
        : highCount > 0 ? 'HIGH'
        : findings.length > 0 ? 'MEDIUM'
        : 'LOW'

    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL 지적사항 ${criticalCount}건 즉시 경영진 보고`)
    if (totalAutomation < 50) recommendations.push(`자동화 커버리지 ${Math.round(totalAutomation)}% — 감사 자동화 확대 필요`)

    return {
      auditId,
      domain,
      totalControls: domainControls.length,
      effectiveControls,
      findings,
      overallRiskRating,
      automationCoverage: Math.round(totalAutomation),
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, controlId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, controlId, detail })
  }
}
