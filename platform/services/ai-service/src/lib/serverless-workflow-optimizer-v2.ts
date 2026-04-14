// Design Ref: §설계결정 — AI기반 서버리스 워크플로우 최적화 v2
// Plan SC: FR-R598.1~5

interface WorkflowRecord { workflowId: string; name: string; functionCount: number }
interface ExecutionRecord { durationMs: number; coldStarts: number; memoryMb: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServerlessWorkflowOptimizerV2 {
  private workflows = new Map<string, WorkflowRecord>()
  private executions = new Map<string, ExecutionRecord[]>()
  private auditLog: AuditEntry[] = []

  registerWorkflow(workflowId: string, name: string, functionCount: number): void {
    this.workflows.set(workflowId, { workflowId, name, functionCount })
    this.executions.set(workflowId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_WORKFLOW', details: { workflowId, name } })
  }

  recordExecution(workflowId: string, durationMs: number, coldStarts: number, memoryMb: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.executions.get(workflowId) ?? []
    entries.push({ durationMs, coldStarts, memoryMb })
    this.executions.set(workflowId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_EXECUTION', details: { workflowId, durationMs, coldStarts } })
  }

  getOptimizationScore(workflowId: string): number {
    const entries = this.executions.get(workflowId) ?? []
    if (entries.length === 0) return 100
    const latest = entries[entries.length - 1]
    // score: penalize high duration and cold starts
    return Math.max(0, 100 - (latest.durationMs / 100) - (latest.coldStarts * 10))
  }

  getSlowWorkflows(threshold: number): WorkflowRecord[] {
    return Array.from(this.workflows.values()).filter(w => this.getOptimizationScore(w.workflowId) < threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
