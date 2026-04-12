/**
 * API 의존성 그래프 분석기 — SVC-AI-ADV-R162
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R162/SVC-AI-ADV-R162.design.md
 * Plan SC: FR-R162.1 ~ FR-R162.6
 *
 * 마이크로서비스 API 의존성 그래프 + 순환 탐지 + 단일장애점 + 영향도.
 * CSAP D-08, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface APIService {
  id: string
  name: string
  team: string
}

export interface CycleReport {
  detected: boolean
  cycles: string[][]
}

export interface SPOFReport {
  services: Array<{ id: string; name: string; inDegree: number }>
}

export interface ImpactReport {
  changedService: string
  directDependents: string[]
  transitiveImpact: string[]
  totalImpacted: number
}

export interface GraphReport {
  totalServices: number
  totalEdges: number
  cycles: CycleReport
  spof: SPOFReport
  analysisAt: number
}

export interface GraphAuditEntry {
  action: 'serviceRegistered' | 'dependencyAdded' | 'graphAnalyzed' | 'impactAnalyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class APIDependencyGraphAnalyzer {
  private readonly services = new Map<string, APIService>()
  private readonly graph = new Map<string, Set<string>>()    // from → to (A calls B)
  private readonly reverseGraph = new Map<string, Set<string>>() // to → from
  private readonly auditLog: GraphAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 API 의존성 그래프 분석기 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R162.1 */
  registerService(service: APIService): void {
    if (!service.id.trim()) throw new Error('service id must not be empty')
    this.services.set(service.id, { ...service })
    if (!this.graph.has(service.id)) this.graph.set(service.id, new Set())
    if (!this.reverseGraph.has(service.id)) this.reverseGraph.set(service.id, new Set())
    this.audit('serviceRegistered', { id: service.id, name: service.name })
  }

  /** FR-R162.2 */
  addDependency(from: string, to: string): void {
    if (!this.services.has(from)) throw new Error(`unknown service: ${from}`)
    if (!this.services.has(to)) throw new Error(`unknown service: ${to}`)
    if (from === to) throw new Error('self-dependency not allowed')

    this.graph.get(from)!.add(to)
    if (!this.reverseGraph.has(to)) this.reverseGraph.set(to, new Set())
    this.reverseGraph.get(to)!.add(from)

    this.audit('dependencyAdded', { from, to })
  }

  /** FR-R162.3 ~ FR-R162.4 */
  analyzeGraph(): GraphReport {
    const cycles = this.detectCycles()
    const spof = this.detectSPOF()

    let totalEdges = 0
    for (const edges of this.graph.values()) totalEdges += edges.size

    const report: GraphReport = {
      totalServices: this.services.size,
      totalEdges,
      cycles,
      spof,
      analysisAt: Date.now(),
    }

    this.audit('graphAnalyzed', {
      services: this.services.size,
      edges: totalEdges,
      cyclesDetected: cycles.detected,
    })

    return report
  }

  /** FR-R162.5 */
  analyzeImpact(serviceId: string): ImpactReport {
    if (!this.services.has(serviceId)) throw new Error(`unknown service: ${serviceId}`)

    // BFS on reverse graph (who depends on serviceId)
    const directDependents = [...(this.reverseGraph.get(serviceId) ?? [])]
    const visited = new Set<string>([serviceId])
    const queue = [...directDependents]
    for (const d of directDependents) visited.add(d)

    const transitive: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const dependent of this.reverseGraph.get(current) ?? []) {
        if (!visited.has(dependent)) {
          visited.add(dependent)
          transitive.push(dependent)
          queue.push(dependent)
        }
      }
    }

    const report: ImpactReport = {
      changedService: serviceId,
      directDependents,
      transitiveImpact: transitive,
      totalImpacted: directDependents.length + transitive.length,
    }

    this.audit('impactAnalyzed', { serviceId, total: report.totalImpacted })
    return report
  }

  /** FR-R162.6 */
  getAuditLog(): readonly GraphAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private detectCycles(): CycleReport {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const allCycles: string[][] = []

    const dfs = (node: string, path: string[]): void => {
      visited.add(node)
      recStack.add(node)
      path.push(node)

      for (const neighbor of this.graph.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path)
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor)
          if (cycleStart !== -1) {
            allCycles.push([...path.slice(cycleStart), neighbor])
          }
        }
      }

      recStack.delete(node)
      path.pop()
    }

    for (const id of this.services.keys()) {
      if (!visited.has(id)) dfs(id, [])
    }

    return { detected: allCycles.length > 0, cycles: allCycles }
  }

  private detectSPOF(): SPOFReport {
    const inDegreeMap = new Map<string, number>()
    for (const id of this.services.keys()) inDegreeMap.set(id, 0)
    for (const edges of this.graph.values()) {
      for (const to of edges) {
        inDegreeMap.set(to, (inDegreeMap.get(to) ?? 0) + 1)
      }
    }

    const sorted = [...inDegreeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, d]) => d > 0)

    return {
      services: sorted.map(([id, inDegree]) => ({
        id,
        name: this.services.get(id)?.name ?? id,
        inDegree,
      })),
    }
  }

  private audit(action: GraphAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
