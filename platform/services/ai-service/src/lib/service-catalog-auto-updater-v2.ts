// Design Ref: §R560 — AI기반 서비스 카탈로그 자동 업데이트 v2
// Plan SC: SVC-AI-ADV-R560-SC01

export type EventType = 'DEPLOY' | 'SCALE' | 'CONFIG_CHANGE' | 'RETIRE' | 'RESTORE'
export type CatalogStatus = 'ACTIVE' | 'DEPRECATED' | 'RETIRED' | 'DRAFT'

export interface ServiceChangeEvent {
  eventId: string
  serviceId: string
  eventType: EventType
  timestamp: string
  payload: Record<string, unknown>
}

export interface CatalogEntry {
  serviceId: string
  name: string
  version: string
  status: CatalogStatus
  replicas: number
  configHash: string
  lastUpdated: string
}

export interface ChangeHistoryItem {
  eventId: string
  eventType: EventType
  timestamp: string
  before: Partial<CatalogEntry>
  after: Partial<CatalogEntry>
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceCatalogAutoUpdaterV2 {
  private catalog = new Map<string, CatalogEntry>()
  private pendingEvents: ServiceChangeEvent[] = []
  private changeHistory = new Map<string, ChangeHistoryItem[]>()
  private auditLog: AuditEntry[] = []

  registerEvent(event: ServiceChangeEvent): void {
    this.pendingEvents.push(event)
    this.appendAudit('event.register', event.serviceId, { eventType: event.eventType, eventId: event.eventId })
  }

  initCatalog(entry: CatalogEntry): void {
    this.catalog.set(entry.serviceId, entry)
    this.changeHistory.set(entry.serviceId, [])
    this.appendAudit('catalog.init', entry.serviceId, { version: entry.version, status: entry.status })
  }

  processEvents(): number {
    let processedCount = 0
    for (const event of this.pendingEvents) {
      const current = this.catalog.get(event.serviceId)
      if (!current) continue

      const before: Partial<CatalogEntry> = { ...current }
      const updated = this.applyEvent(current, event)
      this.catalog.set(event.serviceId, updated)

      const history = this.changeHistory.get(event.serviceId) ?? []
      history.push({ eventId: event.eventId, eventType: event.eventType, timestamp: event.timestamp, before, after: { ...updated } })
      this.changeHistory.set(event.serviceId, history)

      this.appendAudit('event.process', event.serviceId, { eventType: event.eventType, newVersion: updated.version })
      processedCount++
    }
    this.pendingEvents = []
    return processedCount
  }

  getCatalogEntry(serviceId: string): CatalogEntry {
    const entry = this.catalog.get(serviceId)
    if (!entry) throw new Error(`Unknown service: ${serviceId}`)
    return { ...entry }
  }

  getChangeHistory(serviceId: string): ChangeHistoryItem[] {
    return [...(this.changeHistory.get(serviceId) ?? [])]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private applyEvent(current: CatalogEntry, event: ServiceChangeEvent): CatalogEntry {
    const updated = { ...current, lastUpdated: event.timestamp }
    switch (event.eventType) {
      case 'DEPLOY': {
        const newVersion = event.payload['version'] as string | undefined
        if (newVersion) updated.version = newVersion
        updated.status = 'ACTIVE'
        break
      }
      case 'SCALE': {
        const replicas = event.payload['replicas'] as number | undefined
        if (replicas !== undefined) updated.replicas = replicas
        break
      }
      case 'CONFIG_CHANGE': {
        const configHash = event.payload['configHash'] as string | undefined
        if (configHash) updated.configHash = configHash
        break
      }
      case 'RETIRE':
        updated.status = 'DEPRECATED'
        break
      case 'RESTORE':
        updated.status = 'ACTIVE'
        break
    }
    return updated
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
