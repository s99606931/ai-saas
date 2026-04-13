// Design Ref: §R387 — AI기반 자동 API 문서 동기화
// Plan SC: SC-R387

export interface ApiEndpoint {
  endpointId: string
  serviceId: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  version: string
  description: string
  parameters: { name: string; type: string; required: boolean }[]
  responseSchema: string
  deprecated: boolean
}

export interface ApiDocSpec {
  specId: string
  serviceId: string
  version: string
  endpoints: ApiEndpoint[]
  lastUpdatedAt: string
}

export type SyncStatus = 'IN_SYNC' | 'OUTDATED' | 'MISSING_DOC' | 'DEPRECATED_UNDOCUMENTED'

export interface DocSyncReport {
  specId: string
  serviceId: string
  syncStatus: SyncStatus
  totalEndpoints: number
  syncedCount: number
  missingDocs: string[]
  deprecatedEndpoints: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ApiDocSyncAi {
  private specs = new Map<string, ApiDocSpec>()
  private liveEndpoints = new Map<string, ApiEndpoint[]>()
  private auditLog: AuditEntry[] = []

  registerSpec(spec: ApiDocSpec): void {
    this.specs.set(spec.specId, spec)
    this.auditLog.push({ action: 'spec.register', timestamp: new Date().toISOString(), detail: spec.specId })
  }

  registerLiveEndpoints(serviceId: string, endpoints: ApiEndpoint[]): void {
    this.liveEndpoints.set(serviceId, endpoints)
    this.auditLog.push({ action: 'endpoints.register', timestamp: new Date().toISOString(), detail: serviceId })
  }

  sync(specId: string): DocSyncReport {
    const spec = this.specs.get(specId)
    if (!spec) throw new Error(`Spec not found: ${specId}`)

    const live = this.liveEndpoints.get(spec.serviceId) ?? []
    const docPaths = new Set(spec.endpoints.map((e) => `${e.method}:${e.path}`))
    const livePaths = new Set(live.map((e) => `${e.method}:${e.path}`))

    const missingDocs: string[] = []
    for (const ep of live) {
      const key = `${ep.method}:${ep.path}`
      if (!docPaths.has(key)) missingDocs.push(key)
    }

    const deprecatedEndpoints = spec.endpoints
      .filter((e) => e.deprecated)
      .map((e) => `${e.method}:${e.path}`)

    const syncedCount = spec.endpoints.filter((e) => livePaths.has(`${e.method}:${e.path}`)).length

    let syncStatus: SyncStatus
    if (missingDocs.length > 0) {
      syncStatus = 'MISSING_DOC'
    } else if (deprecatedEndpoints.length > 0 && live.some((e) => e.deprecated)) {
      syncStatus = 'DEPRECATED_UNDOCUMENTED'
    } else if (syncedCount === spec.endpoints.length && spec.endpoints.length === live.length) {
      syncStatus = 'IN_SYNC'
    } else {
      syncStatus = 'OUTDATED'
    }

    const recommendations: string[] = []
    if (missingDocs.length > 0) recommendations.push(`미문서화 엔드포인트 ${missingDocs.length}개 — 문서 추가 필요`)
    if (deprecatedEndpoints.length > 0) recommendations.push(`Deprecated 엔드포인트 ${deprecatedEndpoints.length}개 — 제거 일정 수립`)

    this.auditLog.push({ action: 'doc.sync', timestamp: new Date().toISOString(), detail: `${specId}:${syncStatus}` })
    return { specId, serviceId: spec.serviceId, syncStatus, totalEndpoints: spec.endpoints.length, syncedCount, missingDocs, deprecatedEndpoints, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
