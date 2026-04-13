// Plan SC: SVC-AI-ADV-R468
// Design Ref: §단계기준 — >=75:leading, >=50:progressing, >=25:initiating, else lagging
type DTCategory = 'process' | 'technology' | 'culture' | 'data' | 'strategy'
type DTStage = 'leading' | 'progressing' | 'initiating' | 'lagging'
type DataGrade = 'O' | 'C' | 'S'

interface Organization { orgId: string; name: string; type: string }
interface AuditEntry { action: string; detail: string; timestamp: string }

export class DigitalTransformationAssessorV2 {
  private orgs = new Map<string, Organization>()
  private scores = new Map<string, Map<DTCategory, number>>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerOrg(orgId: string, name: string, type = ''): Organization {
    const org: Organization = { orgId, name, type }
    this.orgs.set(orgId, org)
    this.scores.set(orgId, new Map())
    this.log('org.register', `orgId=${orgId}`)
    return org
  }

  recordCategoryScore(orgId: string, category: DTCategory, score: number, dataGrade?: DataGrade): void {
    this.checkGrade(dataGrade)
    if (!this.orgs.has(orgId)) throw new Error('orgId 없음')
    this.scores.get(orgId)!.set(category, score)
    this.log('category.record', `orgId=${orgId} category=${category} score=${score}`)
  }

  getTransformationScore(orgId: string): number {
    const catScores = this.scores.get(orgId)
    if (!catScores || catScores.size === 0) return 0
    const values = Array.from(catScores.values())
    return values.reduce((s, v) => s + v, 0) / values.length
  }

  getTransformationStage(orgId: string): DTStage {
    const score = this.getTransformationScore(orgId)
    if (score >= 75) return 'leading'
    if (score >= 50) return 'progressing'
    if (score >= 25) return 'initiating'
    return 'lagging'
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
