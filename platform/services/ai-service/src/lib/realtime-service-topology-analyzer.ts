// Design Ref: §R415 — AI기반 실시간 서비스 토폴로지 분석
// Plan SC: SC-R415

export interface TopologyNode {
  nodeId: string
  serviceName: string
  tier: 'FRONTEND' | 'BACKEND' | 'DATA' | 'INFRA'
}

export interface TopologyEdge {
  fromNodeId: string
  toNodeId: string
  latencyMs: number
}

export interface TopologyReport {
  totalNodes: number
  totalEdges: number
  spofNodes: string[]
  maxDepth: number
  criticalPath: string[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class RealtimeServiceTopologyAnalyzer {
  private nodes = new Map<string, TopologyNode>()
  private edges: TopologyEdge[] = []
  private auditLog: AuditEntry[] = []

  addNode(node: TopologyNode): void {
    this.nodes.set(node.nodeId, node)
    this.auditLog.push({ action: 'node.add', timestamp: new Date().toISOString(), detail: node.nodeId })
  }

  addEdge(edge: TopologyEdge): void {
    this.edges.push(edge)
    this.auditLog.push({ action: 'edge.add', timestamp: new Date().toISOString(), detail: `${edge.fromNodeId}->${edge.toNodeId}` })
  }

  analyze(): TopologyReport {
    // 인입/아웃 엣지 수 계산
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()

    for (const node of this.nodes.keys()) {
      inDegree.set(node, 0)
      outDegree.set(node, 0)
    }

    for (const edge of this.edges) {
      outDegree.set(edge.fromNodeId, (outDegree.get(edge.fromNodeId) ?? 0) + 1)
      inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) ?? 0) + 1)
    }

    // SPOF: 인입 0개 AND 아웃 ≥ 2개
    const spofNodes: string[] = []
    for (const nodeId of this.nodes.keys()) {
      if ((inDegree.get(nodeId) ?? 0) === 0 && (outDegree.get(nodeId) ?? 0) >= 2) {
        spofNodes.push(nodeId)
      }
    }

    // 최대 경로 깊이 (DFS)
    const visited = new Set<string>()
    const getDepth = (nodeId: string): number => {
      if (visited.has(nodeId)) return 0
      visited.add(nodeId)
      const children = this.edges.filter((e) => e.fromNodeId === nodeId).map((e) => e.toNodeId)
      const depth = children.length === 0 ? 0 : Math.max(...children.map((c) => getDepth(c))) + 1
      visited.delete(nodeId)
      return depth
    }

    let maxDepth = 0
    let deepestRoot = ''
    for (const nodeId of this.nodes.keys()) {
      if ((inDegree.get(nodeId) ?? 0) === 0) {
        const d = getDepth(nodeId)
        if (d > maxDepth) {
          maxDepth = d
          deepestRoot = nodeId
        }
      }
    }

    // 크리티컬 경로: 아웃 엣지 가장 많은 노드부터 순차 추적
    const criticalPath: string[] = []
    if (deepestRoot) {
      let current: string | undefined = deepestRoot
      const pathVisited = new Set<string>()
      while (current && !pathVisited.has(current)) {
        criticalPath.push(current)
        pathVisited.add(current)
        const children = this.edges
          .filter((e) => e.fromNodeId === current)
          .sort((a, b) => (outDegree.get(b.toNodeId) ?? 0) - (outDegree.get(a.toNodeId) ?? 0))
        current = children[0]?.toNodeId
      }
    }

    const recommendations: string[] = []
    if (spofNodes.length > 0) recommendations.push(`SPOF ${spofNodes.length}개 탐지 — 이중화 또는 로드밸런서 도입 권고`)
    if (maxDepth > 5) recommendations.push(`경로 깊이 ${maxDepth} — 서비스 체인 단순화 권고`)

    this.auditLog.push({ action: 'topology.analyze', timestamp: new Date().toISOString(), detail: `nodes=${this.nodes.size},spof=${spofNodes.length}` })
    return { totalNodes: this.nodes.size, totalEdges: this.edges.length, spofNodes, maxDepth, criticalPath, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
