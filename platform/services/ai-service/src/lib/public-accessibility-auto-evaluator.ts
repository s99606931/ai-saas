// Design Ref: §핵심 알고리즘 — 접근성 점수 계산, 이슈 심각도 분류
// Plan SC: SVC-AI-ADV-R382
export type DataGrade = 'O' | 'C' | 'S'
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'pass'

export interface AccessibilityIssue {
  itemId: string
  score: number
  severity: IssueSeverity
}

interface EvalRecord {
  itemId: string
  passed: boolean
  score: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function classifySeverity(score: number): IssueSeverity {
  if (score < 40) return 'critical'
  if (score < 70) return 'major'
  if (score < 90) return 'minor'
  return 'pass'
}

export class PublicAccessibilityAutoEvaluator {
  private services = new Map<string, string>()
  private evaluations = new Map<string, EvalRecord[]>()
  private auditLog: AuditEntry[] = []

  registerService(id: string, name: string, serviceType: string): void {
    if (!id || !name || !serviceType) throw new Error('id, name, serviceType은 필수')
    this.services.set(id, name)
    this.evaluations.set(id, [])
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordEvaluation(serviceId: string, itemId: string, passed: boolean, score: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 접근성 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const evals = this.evaluations.get(serviceId)!
    const existing = evals.findIndex((e) => e.itemId === itemId)
    if (existing >= 0) {
      evals[existing] = { itemId, passed, score }
    } else {
      evals.push({ itemId, passed, score })
    }
    this.auditLog.push({ action: 'evaluation.record', timestamp: new Date().toISOString(), detail: `${serviceId}:${itemId}=${score}` })
  }

  getAccessibilityScore(serviceId: string): number {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    const evals = this.evaluations.get(serviceId) ?? []
    if (evals.length === 0) return 0
    return Math.round(evals.reduce((s, e) => s + e.score, 0) / evals.length * 100) / 100
  }

  getIssues(serviceId: string): AccessibilityIssue[] {
    if (!this.services.has(serviceId)) throw new Error(`serviceId 없음: ${serviceId}`)
    return (this.evaluations.get(serviceId) ?? [])
      .filter((e) => !e.passed)
      .map((e) => ({ itemId: e.itemId, score: e.score, severity: classifySeverity(e.score) }))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
