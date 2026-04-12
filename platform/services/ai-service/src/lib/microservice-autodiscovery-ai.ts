// Design Ref: §R188 — AI기반 마이크로서비스 자동 검색
// Plan SC: SVC-AI-ADV-R188-SC01

export interface ServiceDescriptor {
  serviceId: string
  name: string
  endpoints: string[]
  tags: string[]
  version: string
  healthy: boolean
}

export interface DiscoveryQuery {
  queryId: string
  intent: string
  requiredTags?: string[]
  minVersion?: string
}

export interface DiscoveryResult {
  queryId: string
  matches: Array<{ serviceId: string; name: string; score: number }>
  totalFound: number
}

interface AuditEntry {
  timestamp: string
  action: string
  queryId: string
  detail: Record<string, unknown>
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export class MicroserviceAutodiscoveryAI {
  private registry = new Map<string, ServiceDescriptor>()
  private auditLog: AuditEntry[] = []

  registerService(descriptor: ServiceDescriptor): void {
    this.registry.set(descriptor.serviceId, descriptor)
    this.appendAudit('service.register', descriptor.serviceId, { name: descriptor.name })
  }

  discover(query: DiscoveryQuery): DiscoveryResult {
    this.appendAudit('discovery.start', query.queryId, { intent: query.intent })

    const intentTokens = query.intent.toLowerCase().split(/\s+/)
    const candidates = Array.from(this.registry.values()).filter((s) => {
      if (!s.healthy) return false
      if (query.requiredTags && query.requiredTags.length > 0) {
        const hasAll = query.requiredTags.every((t) => s.tags.includes(t))
        if (!hasAll) return false
      }
      if (query.minVersion) {
        if (compareVersions(s.version, query.minVersion) < 0) return false
      }
      return true
    })

    const scored = candidates.map((s) => {
      const searchableText = [s.name.toLowerCase(), ...s.tags.map((t) => t.toLowerCase()), ...s.endpoints.map((e) => e.toLowerCase())].join(' ')
      const matchCount = intentTokens.filter((token) => searchableText.includes(token)).length
      const score = matchCount / intentTokens.length
      return { serviceId: s.serviceId, name: s.name, score }
    })

    const matches = scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score)

    this.appendAudit('discovery.complete', query.queryId, { totalFound: matches.length })
    return { queryId: query.queryId, matches, totalFound: matches.length }
  }

  getRegistry(): ServiceDescriptor[] {
    return Array.from(this.registry.values())
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, queryId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, queryId, detail })
  }
}
