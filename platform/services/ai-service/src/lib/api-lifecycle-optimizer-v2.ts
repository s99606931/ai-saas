// Design Ref: §클래스 설계 — ApiLifecycleOptimizerV2
// Plan SC: SVC-AI-ADV-R537

type ApiStatus = 'active' | 'deprecated' | 'retired'

interface ApiVersion {
  apiId: string
  version: string
  status: ApiStatus
  releaseDate: string
}

interface UsageRecord {
  callCount: number
  errorCount: number
}

interface AuditEntry {
  timestamp: string
  action: string
  apiId: string
  details?: Record<string, unknown>
}

export class ApiLifecycleOptimizerV2 {
  private apis = new Map<string, ApiVersion>()
  private usage = new Map<string, UsageRecord>()
  private auditLog: AuditEntry[] = []

  registerApi(apiId: string, version: string, status: ApiStatus, releaseDate: string): ApiVersion {
    const api: ApiVersion = { apiId, version, status, releaseDate }
    this.apis.set(apiId, api)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_API', apiId, details: { version, status, releaseDate } })
    return api
  }

  recordUsage(apiId: string, callCount: number, errorCount: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.apis.has(apiId)) throw new Error(`API를 찾을 수 없습니다: ${apiId}`)
    const existing = this.usage.get(apiId)
    this.usage.set(apiId, {
      callCount: (existing?.callCount ?? 0) + callCount,
      errorCount: (existing?.errorCount ?? 0) + errorCount,
    })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_USAGE', apiId, details: { callCount, errorCount } })
  }

  getHealthScore(apiId: string): number {
    const record = this.usage.get(apiId)
    if (!record || record.callCount === 0) return 100
    return Math.max(0, (1 - record.errorCount / record.callCount) * 100)
  }

  getDeprecatedApis(): ApiVersion[] {
    return Array.from(this.apis.values()).filter(api => api.status === 'deprecated')
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
