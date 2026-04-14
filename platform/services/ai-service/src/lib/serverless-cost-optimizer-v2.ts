// Design Ref: §설계결정 — AI기반 서버리스 비용 최적화 v2
// Plan SC: FR-R620.1~5

interface FunctionRecord { functionId: string; name: string; memoryMb: number; region: string }
interface InvocationRecord { durationMs: number; billedMs: number; costUsd: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ServerlessCostOptimizerV2 {
  private functions = new Map<string, FunctionRecord>()
  private invocations = new Map<string, InvocationRecord[]>()
  private auditLog: AuditEntry[] = []

  registerFunction(functionId: string, name: string, memoryMb: number, region: string): void {
    this.functions.set(functionId, { functionId, name, memoryMb, region })
    this.invocations.set(functionId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_FUNCTION', details: { functionId, name } })
  }

  recordInvocation(functionId: string, durationMs: number, billedMs: number, costUsd: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.invocations.get(functionId) ?? []
    entries.push({ durationMs, billedMs, costUsd })
    this.invocations.set(functionId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_INVOCATION', details: { functionId, durationMs, costUsd } })
  }

  getTotalCost(functionId: string): number {
    const entries = this.invocations.get(functionId) ?? []
    return entries.reduce((sum, e) => sum + e.costUsd, 0)
  }

  getAverageDuration(functionId: string): number {
    const entries = this.invocations.get(functionId) ?? []
    if (entries.length === 0) return 0
    return entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length
  }

  getHighCostFunctions(thresholdUsd: number): FunctionRecord[] {
    return Array.from(this.functions.values()).filter(f => this.getTotalCost(f.functionId) > thresholdUsd)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
