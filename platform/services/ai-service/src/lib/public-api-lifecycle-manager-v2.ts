// Design Ref: §설계결정 — AI기반 공공 API 생명주기 관리 v2
// Plan SC: FR-R629.1~5

type LifecycleStage = 'active' | 'deprecated' | 'retired'
interface ApiRecord {
  apiId: string
  stage: LifecycleStage
  deprecatedAt?: string
  retireAfterDays?: number
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicApiLifecycleManagerV2 {
  private apis = new Map<string, ApiRecord>()
  private auditLog: AuditEntry[] = []

  registerApi(apiId: string): void {
    this.apis.set(apiId, { apiId, stage: 'active' })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_API', details: { apiId } })
  }

  transition(apiId: string, next: LifecycleStage, retireAfterDays?: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const record = this.apis.get(apiId)
    if (!record) throw new Error('API_NOT_FOUND')
    record.stage = next
    if (next === 'deprecated') {
      record.deprecatedAt = new Date().toISOString()
      record.retireAfterDays = retireAfterDays ?? 90
    }
    this.apis.set(apiId, record)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'TRANSITION', details: { apiId, next } })
  }

  getRetireCandidates(now: Date = new Date()): ApiRecord[] {
    return Array.from(this.apis.values()).filter(r => {
      if (r.stage !== 'deprecated') return false
      if (!r.deprecatedAt || r.retireAfterDays === undefined) return false
      const deprecatedAt = new Date(r.deprecatedAt).getTime()
      const elapsedDays = (now.getTime() - deprecatedAt) / (1000 * 60 * 60 * 24)
      return elapsedDays >= r.retireAfterDays
    })
  }

  getStage(apiId: string): LifecycleStage | null {
    return this.apis.get(apiId)?.stage ?? null
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
