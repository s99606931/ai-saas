// Design Ref: §설계결정 — AI기반 인프라 드리프트 탐지 v2
// Plan SC: FR-R631.1~5

interface ResourceState { resourceId: string; declared: Record<string, string>; actual?: Record<string, string>; driftScore: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class InfrastructureDriftDetectorV2 {
  private resources = new Map<string, ResourceState>()
  private auditLog: AuditEntry[] = []

  registerResource(resourceId: string, declared: Record<string, string>): void {
    this.resources.set(resourceId, { resourceId, declared, driftScore: 0 })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_RESOURCE', details: { resourceId } })
  }

  recordActual(resourceId: string, actual: Record<string, string>, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const resource = this.resources.get(resourceId)
    if (!resource) throw new Error('RESOURCE_NOT_FOUND')
    resource.actual = actual
    resource.driftScore = this.computeDrift(resource.declared, actual)
    this.resources.set(resourceId, resource)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_ACTUAL', details: { resourceId, driftScore: resource.driftScore } })
  }

  private computeDrift(declared: Record<string, string>, actual: Record<string, string>): number {
    const keys = new Set([...Object.keys(declared), ...Object.keys(actual)])
    if (keys.size === 0) return 0
    let diff = 0
    for (const k of keys) {
      if (declared[k] !== actual[k]) diff++
    }
    return diff / keys.size
  }

  getDriftScore(resourceId: string): number {
    return this.resources.get(resourceId)?.driftScore ?? 0
  }

  getHighDriftResources(threshold: number): ResourceState[] {
    return Array.from(this.resources.values()).filter(r => r.driftScore > threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
