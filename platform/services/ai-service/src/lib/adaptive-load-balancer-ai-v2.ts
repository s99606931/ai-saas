// Design Ref: §설계결정 — AI기반 적응형 로드밸런서 v2
// Plan SC: FR-R636.1~5

interface BackendRecord { backendId: string; capacity: number; loads: number[] }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class AdaptiveLoadBalancerAiV2 {
  private backends = new Map<string, BackendRecord>()
  private auditLog: AuditEntry[] = []

  registerBackend(backendId: string, capacity: number): void {
    this.backends.set(backendId, { backendId, capacity, loads: [] })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_BACKEND', details: { backendId, capacity } })
  }

  recordLoad(backendId: string, load: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const backend = this.backends.get(backendId)
    if (!backend) throw new Error('BACKEND_NOT_FOUND')
    backend.loads.push(load)
    this.backends.set(backendId, backend)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_LOAD', details: { backendId, load } })
  }

  selectBackend(): string | null {
    const entries = Array.from(this.backends.values())
    if (entries.length === 0) return null
    const sorted = entries
      .map(b => ({ id: b.backendId, latest: b.loads.length === 0 ? 0 : b.loads[b.loads.length - 1]! }))
      .sort((a, b) => a.latest - b.latest)
    return sorted[0]!.id
  }

  getSaturatedBackends(saturationThreshold: number): BackendRecord[] {
    return Array.from(this.backends.values()).filter(b => {
      if (b.loads.length === 0) return false
      return b.loads[b.loads.length - 1]! >= saturationThreshold
    })
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
