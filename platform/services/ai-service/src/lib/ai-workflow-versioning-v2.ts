// Design Ref: §설계결정 — AI기반 워크플로우 버전 관리 v2
// Plan SC: FR-R628.1~5

interface WorkflowVersion {
  workflowId: string
  version: number
  score: number
  createdAt: string
  notes: string
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class AiWorkflowVersioningV2 {
  private versions = new Map<string, WorkflowVersion[]>()
  private auditLog: AuditEntry[] = []

  registerVersion(workflowId: string, version: number, score: number, notes: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const list = this.versions.get(workflowId) ?? []
    list.push({ workflowId, version, score, createdAt: new Date().toISOString(), notes })
    this.versions.set(workflowId, list)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_VERSION', details: { workflowId, version, score } })
  }

  getLatest(workflowId: string): WorkflowVersion | null {
    const list = this.versions.get(workflowId) ?? []
    if (list.length === 0) return null
    return list[list.length - 1]!
  }

  detectRegression(workflowId: string, regressionThreshold: number): boolean {
    const list = this.versions.get(workflowId) ?? []
    if (list.length < 2) return false
    const last = list[list.length - 1]!
    const prev = list[list.length - 2]!
    const regression = prev.score - last.score >= regressionThreshold
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'DETECT_REGRESSION', details: { workflowId, regression } })
    return regression
  }

  listVersions(workflowId: string): WorkflowVersion[] {
    return [...(this.versions.get(workflowId) ?? [])]
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
