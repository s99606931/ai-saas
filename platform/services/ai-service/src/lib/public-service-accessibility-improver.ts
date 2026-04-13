// Design Ref: §핵심 알고리즘 — 접근성 점수 계산, 위반 분류
// Plan SC: SVC-AI-ADV-R330
export type DataGrade = 'O' | 'C' | 'S'
export type AccessibilitySeverity = 'critical' | 'major' | 'minor'

export interface AccessibilityCheck {
  checkId: string
  checkName: string
  score: number
}

export interface AccessibilityViolation {
  checkId: string
  checkName: string
  score: number
  severity: AccessibilitySeverity
}

export interface AccessibilityResult {
  serviceId: string
  overallScore: number
  checkCount: number
  violations: AccessibilityViolation[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function classifySeverity(score: number): AccessibilitySeverity | null {
  if (score < 40) return 'critical'
  if (score < 70) return 'major'
  if (score < 90) return 'minor'
  return null
}

export class PublicServiceAccessibilityImprover {
  private services = new Map<string, string>()
  private checks = new Map<string, AccessibilityCheck[]>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.services.set(id, name)
    this.checks.set(id, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordAccessibilityCheck(
    serviceId: string,
    checkId: string,
    checkName: string,
    score: number,
    grade: DataGrade = 'O'
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 접근성 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    if (score < 0 || score > 100) throw new Error('score는 0~100')
    this.checks.get(serviceId)!.push({ checkId, checkName, score })
    this.auditLog.push({ action: 'check.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${checkId}=${score}` })
  }

  getAccessibilityScore(serviceId: string): AccessibilityResult {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const checkList = this.checks.get(serviceId) ?? []
    const count = checkList.length
    const overallScore = count === 0 ? 0 : Math.round(checkList.reduce((s, c) => s + c.score, 0) / count)
    const violations: AccessibilityViolation[] = []
    for (const check of checkList) {
      const severity = classifySeverity(check.score)
      if (severity !== null) {
        violations.push({ checkId: check.checkId, checkName: check.checkName, score: check.score, severity })
      }
    }
    return { serviceId, overallScore, checkCount: count, violations }
  }

  getImprovementSuggestions(serviceId: string): string[] {
    const result = this.getAccessibilityScore(serviceId)
    const suggestions: string[] = []
    for (const v of result.violations) {
      if (v.severity === 'critical') suggestions.push(`즉시 수정 필요: ${v.checkName}`)
      else if (v.severity === 'major') suggestions.push(`개선 권고: ${v.checkName}`)
    }
    return suggestions
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
