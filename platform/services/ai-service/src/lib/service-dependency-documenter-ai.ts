// Design Ref: §R268 — AI기반 서비스 의존성 자동 문서화
// Plan SC: SVC-AI-ADV-R268-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type DependencyType = 'SYNC' | 'ASYNC' | 'DATABASE' | 'CACHE' | 'EXTERNAL'
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNKNOWN'

export interface ServiceDefinition {
  serviceId: string
  name: string
  version: string
  team: string
}

export interface ServiceDependency {
  fromServiceId: string
  toServiceId: string
  dependencyType: DependencyType
  criticalPath: boolean
}

export interface ServiceDoc {
  serviceId: string
  name: string
  version: string
  team: string
  dependencies: ServiceDependency[]
  dependents: string[]  // 이 서비스에 의존하는 serviceId 목록
  criticalPathCount: number
  healthStatus: HealthStatus
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceDependencyDocumenterAi {
  private services = new Map<string, ServiceDefinition>()
  private dependencies: ServiceDependency[] = []
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceDefinition): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, version: service.version })
  }

  addDependency(dep: ServiceDependency): void {
    if (!this.services.has(dep.fromServiceId)) throw new Error(`Unknown service: ${dep.fromServiceId}`)
    if (!this.services.has(dep.toServiceId)) throw new Error(`Unknown service: ${dep.toServiceId}`)
    this.dependencies.push(dep)
    this.appendAudit('dependency.add', dep.fromServiceId, { toServiceId: dep.toServiceId, type: dep.dependencyType })
  }

  generateDoc(serviceId: string): ServiceDoc {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    const outbound = this.dependencies.filter((d) => d.fromServiceId === serviceId)
    const inbound = this.dependencies.filter((d) => d.toServiceId === serviceId)
    const criticalPathCount = outbound.filter((d) => d.criticalPath).length

    // 크리티컬 패스 의존성이 UNKNOWN이면 DEGRADED, 없으면 HEALTHY
    const healthStatus: HealthStatus = criticalPathCount > 3 ? 'DEGRADED' : 'HEALTHY'

    this.appendAudit('doc.generate', serviceId, { dependencyCount: outbound.length, criticalPathCount })

    return {
      serviceId,
      name: service.name,
      version: service.version,
      team: service.team,
      dependencies: outbound,
      dependents: inbound.map((d) => d.fromServiceId),
      criticalPathCount,
      healthStatus,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
