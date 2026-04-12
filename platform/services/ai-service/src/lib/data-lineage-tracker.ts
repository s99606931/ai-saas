/**
 * Data Lineage Tracker — SVC-AI-ADV-R95
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R95.design.md
 * Plan SC: FR-R95.1 ~ FR-R95.5
 *
 * 공공 데이터 흐름 그래프. 개인정보보호법/공공기록물법 준수 증거.
 */

export type DataGrade = 'O' | 'C' | 'S'

export type NodeType = 'SOURCE' | 'TRANSFORM' | 'SINK'

export type Operation = 'COPY' | 'TRANSFORM' | 'JOIN' | 'EXPORT'

export interface DatasetNode {
  id: string
  grade: DataGrade
  owner: string
  type: NodeType
  tags: string[]
  createdAt: string
}

export interface FlowEdge {
  from: string
  to: string
  operation: Operation
  purpose: string
  timestamp: string
}

export interface LineagePath {
  nodes: string[]
  maxGrade: DataGrade
}

export interface LineageTrace {
  nodeId: string
  upstream: DatasetNode[]
  downstream: DatasetNode[]
  paths: LineagePath[]
}

export type ViolationType =
  | 'EXTERNAL_SENSITIVE'
  | 'UNGRADED_SINK'
  | 'GRADE_DOWNGRADE'

export interface Violation {
  type: ViolationType
  nodeId: string
  edge?: FlowEdge
  description: string
}

export interface AuditSink {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

const GRADE_RANK: Record<DataGrade, number> = { O: 0, C: 1, S: 2 }

function maxGrade(a: DataGrade, b: DataGrade): DataGrade {
  return GRADE_RANK[a] >= GRADE_RANK[b] ? a : b
}

export class DataLineageTracker {
  private readonly nodes = new Map<string, DatasetNode>()
  private readonly outEdges = new Map<string, FlowEdge[]>()
  private readonly inEdges = new Map<string, FlowEdge[]>()

  constructor(private readonly audit?: AuditSink) {}

  /**
   * FR-R95.1: 데이터셋 노드 등록.
   */
  registerDataset(node: Omit<DatasetNode, 'createdAt'>): DatasetNode {
    const full: DatasetNode = {
      ...node,
      createdAt: new Date().toISOString(),
    }
    this.nodes.set(full.id, full)
    if (!this.outEdges.has(full.id)) this.outEdges.set(full.id, [])
    if (!this.inEdges.has(full.id)) this.inEdges.set(full.id, [])
    return full
  }

  /**
   * FR-R95.2, FR-R95.4: 데이터 흐름 엣지 기록 + 등급 전파.
   */
  recordFlow(
    from: string,
    to: string,
    operation: Operation,
    purpose: string,
  ): FlowEdge {
    const src = this.nodes.get(from)
    const dst = this.nodes.get(to)
    if (!src) throw new Error(`source node not found: ${from}`)
    if (!dst) throw new Error(`destination node not found: ${to}`)

    const edge: FlowEdge = {
      from,
      to,
      operation,
      purpose,
      timestamp: new Date().toISOString(),
    }
    this.outEdges.get(from)!.push(edge)
    this.inEdges.get(to)!.push(edge)

    // 등급 자동 전파 (downgrade 방지)
    const propagated = maxGrade(src.grade, dst.grade)
    if (propagated !== dst.grade) {
      dst.grade = propagated
    }

    return edge
  }

  /**
   * FR-R95.3: 상/하류 계보 추적 (BFS).
   */
  traceLineage(nodeId: string): LineageTrace {
    const node = this.nodes.get(nodeId)
    if (!node) throw new Error(`node not found: ${nodeId}`)

    const upstream = this.bfs(nodeId, 'in')
    const downstream = this.bfs(nodeId, 'out')
    const paths = this.enumeratePaths(nodeId)

    return {
      nodeId,
      upstream,
      downstream,
      paths,
    }
  }

  /**
   * FR-R95.5: 법적 위반 탐지.
   */
  detectViolations(): Violation[] {
    const violations: Violation[] = []
    for (const node of this.nodes.values()) {
      if (node.type === 'SINK' && node.tags.includes('external')) {
        if (node.grade === 'C' || node.grade === 'S') {
          const incoming = this.inEdges.get(node.id) ?? []
          const edge = incoming[0]
          violations.push({
            type: 'EXTERNAL_SENSITIVE',
            nodeId: node.id,
            edge,
            description: `${node.grade}등급 데이터가 외부 싱크(${node.id})로 전송`,
          })
        }
      }
      if (node.type === 'SINK' && !node.tags.includes('external') && (this.inEdges.get(node.id) ?? []).length === 0) {
        // not a violation but "UNGRADED_SINK" catch-all left for future
      }
    }
    return violations
  }

  /**
   * 감사 로그 일괄 방출.
   */
  async emitAudit(): Promise<void> {
    if (!this.audit) return
    await this.audit.log('lineage.snapshot', {
      nodes: this.nodes.size,
      edges: Array.from(this.outEdges.values()).reduce(
        (n, arr) => n + arr.length,
        0,
      ),
    })
  }

  snapshot(): { nodes: DatasetNode[]; edges: FlowEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.outEdges.values()).flat(),
    }
  }

  private bfs(start: string, dir: 'in' | 'out'): DatasetNode[] {
    const visited = new Set<string>([start])
    const queue: string[] = [start]
    const result: DatasetNode[] = []
    while (queue.length > 0) {
      const cur = queue.shift()!
      const edges =
        dir === 'out' ? this.outEdges.get(cur) : this.inEdges.get(cur)
      if (!edges) continue
      for (const edge of edges) {
        const next = dir === 'out' ? edge.to : edge.from
        if (visited.has(next)) continue
        visited.add(next)
        const node = this.nodes.get(next)
        if (node) result.push(node)
        queue.push(next)
      }
    }
    return result
  }

  private enumeratePaths(start: string): LineagePath[] {
    const paths: LineagePath[] = []
    const maxDepth = 20
    const walk = (cur: string, path: string[], mg: DataGrade): void => {
      if (path.length >= maxDepth) return
      const node = this.nodes.get(cur)
      if (!node) return
      const newMax = maxGrade(mg, node.grade)
      const outs = this.outEdges.get(cur) ?? []
      if (outs.length === 0 && path.length > 1) {
        paths.push({ nodes: [...path], maxGrade: newMax })
        return
      }
      for (const edge of outs) {
        if (path.includes(edge.to)) continue // cycle guard
        walk(edge.to, [...path, edge.to], newMax)
      }
    }
    walk(start, [start], 'O')
    return paths
  }
}
