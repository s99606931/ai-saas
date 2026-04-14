// Design Ref: §R584 — AI기반 자동 마이크로서비스 검색 v2
// Plan SC: SVC-AI-ADV-R584-SC01

export type ServiceStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN'

export interface MicroserviceInfo {
  serviceId: string
  name: string
  version: string
  host: string
  port: number
  status: ServiceStatus
  tags: string[]
  dependencies: string[]   // 의존 서비스 ID 목록
  registeredAt: string
}

export interface DiscoveryFilter {
  status?: ServiceStatus
  tags?: string[]
  nameContains?: string
}

export interface DependencyMap {
  serviceId: string
  directDependencies: string[]
  transitiveDependencies: string[]
  dependents: string[]    // 이 서비스에 의존하는 서비스
}

export interface HealthCheckResult {
  serviceId: string
  name: string
  status: ServiceStatus
  lastCheckedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class MicroserviceAutodiscoveryV2 {
  private registry = new Map<string, MicroserviceInfo>()
  private auditLog: AuditEntry[] = []

  registerService(service: MicroserviceInfo): void {
    this.registry.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, status: service.status })
  }

  updateStatus(serviceId: string, status: ServiceStatus): void {
    const service = this.registry.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)
    this.registry.set(serviceId, { ...service, status })
    this.appendAudit('service.statusUpdate', serviceId, { newStatus: status })
  }

  discover(filter?: DiscoveryFilter): MicroserviceInfo[] {
    let results = Array.from(this.registry.values())

    if (filter?.status) {
      results = results.filter((s) => s.status === filter.status)
    }
    if (filter?.tags && filter.tags.length > 0) {
      const filterTags = filter.tags
      results = results.filter((s) => filterTags.some((t) => s.tags.includes(t)))
    }
    if (filter?.nameContains) {
      const lowerName = filter.nameContains.toLowerCase()
      results = results.filter((s) => s.name.toLowerCase().includes(lowerName))
    }

    this.appendAudit('service.discover', 'system', { filterApplied: JSON.stringify(filter ?? {}), resultCount: results.length })
    return results
  }

  mapDependencies(serviceId: string): DependencyMap {
    const service = this.registry.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const directDependencies = service.dependencies

    // 전이적 의존성 (BFS)
    const visited = new Set<string>()
    const queue = [...directDependencies]
    while (queue.length > 0) {
      const depId = queue.shift()
      if (depId === undefined) continue
      if (visited.has(depId) || depId === serviceId) continue
      visited.add(depId)
      const dep = this.registry.get(depId)
      if (dep) queue.push(...dep.dependencies)
    }
    const transitiveDependencies = Array.from(visited).filter((id) => !directDependencies.includes(id))

    // 역방향: 이 서비스에 의존하는 서비스
    const dependents = Array.from(this.registry.values())
      .filter((s) => s.dependencies.includes(serviceId))
      .map((s) => s.serviceId)

    this.appendAudit('dependency.map', serviceId, { directCount: directDependencies.length })
    return { serviceId, directDependencies, transitiveDependencies, dependents }
  }

  healthCheck(): HealthCheckResult[] {
    const results = Array.from(this.registry.values()).map((s) => ({
      serviceId: s.serviceId,
      name: s.name,
      status: s.status,
      lastCheckedAt: new Date().toISOString(),
    }))
    const downCount = results.filter((r) => r.status === 'DOWN').length
    this.appendAudit('health.check', 'system', { totalServices: results.length, downCount })
    return results
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
