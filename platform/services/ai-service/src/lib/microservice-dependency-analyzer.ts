/**
 * Microservice Dependency Analyzer — SVC-AI-ADV-R108 (트랙 B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R108-microservice.design.md
 * Plan SC: FR-R108-M.1 ~ FR-R108-M.6
 *
 * 서비스 간 의존성 그래프 자동 생성 + 순환 의존 탐지 (DFS) + 영향 분석 (BFS).
 * 외부 API 없음 — 순수 그래프 계산.
 */

// Design Ref: §2 — 타입 정의

export type DependencyType = 'SYNC' | 'ASYNC' | 'OPTIONAL'

export interface ServiceMetadata {
  serviceId: string
  description?: string
  team?: string
  criticality?: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface Dependency {
  from: string
  to: string
  type: DependencyType
  registeredAt: string
}

export interface CycleReport {
  cycle: string[]
  length: number
  detectedAt: string
}

export interface GraphExport {
  services: ServiceMetadata[]
  dependencies: Dependency[]
  exportedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 — 색상 상수
type NodeColor = 'WHITE' | 'GRAY' | 'BLACK'

export class MicroserviceDependencyAnalyzer {
  // Plan SC: FR-R108-M.1
  private readonly services = new Map<string, ServiceMetadata>()
  private readonly dependencies: Dependency[] = []
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R108-M.1
  registerService(metadata: ServiceMetadata): void {
    this.services.set(metadata.serviceId, { ...metadata })
    this.appendAudit('service.register', { serviceId: metadata.serviceId })
  }

  // Plan SC: FR-R108-M.2
  addDependency(from: string, to: string, type: DependencyType = 'SYNC'): void {
    if (!this.services.has(from)) {
      throw new Error(`Unknown service: ${from}`)
    }
    if (!this.services.has(to)) {
      throw new Error(`Unknown service: ${to}`)
    }
    const existing = this.dependencies.find((d) => d.from === from && d.to === to)
    if (existing) return // 중복 의존성 무시

    this.dependencies.push({
      from,
      to,
      type,
      registeredAt: new Date().toISOString(),
    })
    this.appendAudit('dependency.add', { from, to, type })
  }

  // Plan SC: FR-R108-M.3 — Design Ref: §3.1 DFS 순환 탐지
  detectCycles(): CycleReport[] {
    const adjacency = this.buildAdjacency()
    const color = new Map<string, NodeColor>()
    const parent = new Map<string, string | null>()
    const cycles: CycleReport[] = []

    for (const serviceId of this.services.keys()) {
      color.set(serviceId, 'WHITE')
      parent.set(serviceId, null)
    }

    const dfs = (node: string, path: string[]): void => {
      color.set(node, 'GRAY')
      const neighbors = adjacency.get(node) ?? []
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === 'GRAY') {
          // 순환 발견 — 경로에서 순환 구간 추출
          const cycleStart = path.indexOf(neighbor)
          const cycleNodes = path.slice(cycleStart)
          cycleNodes.push(neighbor) // 닫힘
          cycles.push({
            cycle: cycleNodes,
            length: cycleNodes.length - 1,
            detectedAt: new Date().toISOString(),
          })
        } else if (color.get(neighbor) === 'WHITE') {
          dfs(neighbor, [...path, neighbor])
        }
      }
      color.set(node, 'BLACK')
    }

    for (const serviceId of this.services.keys()) {
      if (color.get(serviceId) === 'WHITE') {
        dfs(serviceId, [serviceId])
      }
    }

    this.appendAudit('cycles.detect', { cycleCount: cycles.length })
    return cycles
  }

  // Plan SC: FR-R108-M.4 — Design Ref: §3.2 BFS 역방향 영향 분석
  getImpactPath(serviceId: string): string[] {
    if (!this.services.has(serviceId)) {
      throw new Error(`Unknown service: ${serviceId}`)
    }
    // 역방향 인접 리스트 구성 (이 서비스를 의존하는 서비스들)
    const reverseAdj = new Map<string, string[]>()
    for (const dep of this.dependencies) {
      const existing = reverseAdj.get(dep.to) ?? []
      existing.push(dep.from)
      reverseAdj.set(dep.to, existing)
    }

    const visited = new Set<string>()
    const queue: string[] = [serviceId]
    visited.add(serviceId)

    while (queue.length > 0) {
      const current = queue.shift()!
      const dependents = reverseAdj.get(current) ?? []
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep)
          queue.push(dep)
        }
      }
    }

    visited.delete(serviceId) // 자기 자신 제외
    this.appendAudit('impact.analyze', { serviceId, impactCount: visited.size })
    return [...visited]
  }

  // Plan SC: FR-R108-M.5
  exportGraph(): GraphExport {
    return {
      services: [...this.services.values()],
      dependencies: [...this.dependencies],
      exportedAt: new Date().toISOString(),
    }
  }

  // Plan SC: FR-R108-M.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private buildAdjacency(): Map<string, string[]> {
    const adj = new Map<string, string[]>()
    for (const serviceId of this.services.keys()) {
      adj.set(serviceId, [])
    }
    for (const dep of this.dependencies) {
      const neighbors = adj.get(dep.from) ?? []
      neighbors.push(dep.to)
      adj.set(dep.from, neighbors)
    }
    return adj
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    })
  }
}
