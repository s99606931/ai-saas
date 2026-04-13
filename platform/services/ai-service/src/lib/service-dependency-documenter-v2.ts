// Design Ref: §R402 — AI기반 서비스 의존성 자동 문서화 v2
// Plan SC: SVC-AI-ADV-R402-SC01

export type DependencyType = 'SYNC' | 'ASYNC' | 'DATABASE' | 'CACHE' | 'EXTERNAL'
export type DocumentFormat = 'MARKDOWN' | 'MERMAID' | 'JSON'

export interface ServiceDefinition {
  serviceId: string
  name: string
  version: string
  team: string
  description: string
}

export interface DependencyEdge {
  fromServiceId: string
  toServiceId: string
  type: DependencyType
  protocol?: string  // HTTP, gRPC, AMQP 등
  critical: boolean
}

export interface DependencyDocument {
  serviceId: string
  format: DocumentFormat
  content: string
  dependencyCount: number
  criticalDependencies: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceDependencyDocumenterV2 {
  private services = new Map<string, ServiceDefinition>()
  private edges: DependencyEdge[] = []
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceDefinition): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, version: service.version })
  }

  addDependency(edge: DependencyEdge): void {
    if (!this.services.has(edge.fromServiceId)) throw new Error(`Unknown service: ${edge.fromServiceId}`)
    if (!this.services.has(edge.toServiceId)) throw new Error(`Unknown service: ${edge.toServiceId}`)
    this.edges.push(edge)
    this.appendAudit('dependency.add', edge.fromServiceId, { to: edge.toServiceId, type: edge.type })
  }

  document(serviceId: string, format: DocumentFormat): DependencyDocument {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    // 이 서비스의 아웃바운드 의존성
    const outbound = this.edges.filter((e) => e.fromServiceId === serviceId)
    // 이 서비스에 의존하는 인바운드
    const inbound = this.edges.filter((e) => e.toServiceId === serviceId)

    const criticalDependencies = outbound
      .filter((e) => e.critical)
      .map((e) => {
        const dep = this.services.get(e.toServiceId)
        return dep?.name ?? e.toServiceId
      })

    let content = ''
    const now = new Date().toISOString()

    if (format === 'MARKDOWN') {
      const lines = [
        `# ${service.name} 서비스 의존성 문서`,
        ``,
        `**버전**: ${service.version} | **팀**: ${service.team} | **생성일**: ${now}`,
        ``,
        `## 서비스 설명`,
        service.description,
        ``,
        `## 아웃바운드 의존성 (${outbound.length}개)`,
        ``,
        `| 서비스 | 유형 | 프로토콜 | 크리티컬 |`,
        `|--------|------|----------|----------|`,
        ...outbound.map((e) => {
          const dep = this.services.get(e.toServiceId)
          return `| ${dep?.name ?? e.toServiceId} | ${e.type} | ${e.protocol ?? '-'} | ${e.critical ? '예' : '아니요'} |`
        }),
        ``,
        `## 인바운드 의존성 (${inbound.length}개)`,
        ``,
        ...inbound.map((e) => {
          const src = this.services.get(e.fromServiceId)
          return `- **${src?.name ?? e.fromServiceId}** (${e.type})`
        }),
      ]
      content = lines.join('\n')
    } else if (format === 'MERMAID') {
      const lines = [
        `graph LR`,
        `  ${serviceId}["${service.name}"]`,
        ...outbound.map((e) => {
          const dep = this.services.get(e.toServiceId)
          const label = `${e.type}${e.critical ? '⚠' : ''}`
          return `  ${serviceId} -->|${label}| ${e.toServiceId}["${dep?.name ?? e.toServiceId}"]`
        }),
        ...inbound.map((e) => {
          const src = this.services.get(e.fromServiceId)
          return `  ${e.fromServiceId}["${src?.name ?? e.fromServiceId}"] --> ${serviceId}`
        }),
      ]
      content = lines.join('\n')
    } else {
      content = JSON.stringify({
        service: { id: serviceId, name: service.name, version: service.version },
        outbound: outbound.map((e) => ({ to: e.toServiceId, type: e.type, critical: e.critical })),
        inbound: inbound.map((e) => ({ from: e.fromServiceId, type: e.type })),
        criticalDependencies,
        generatedAt: now,
      }, null, 2)
    }

    this.appendAudit('dependency.document', serviceId, { format, outbound: outbound.length, inbound: inbound.length })

    return {
      serviceId,
      format,
      content,
      dependencyCount: outbound.length,
      criticalDependencies,
      generatedAt: now,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
