/**
 * Graph Anomaly Propagator — SVC-AI-ADV-R101
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R101.design.md
 * Plan SC: FR-R101.1 ~ FR-R101.5
 *
 * 서비스 의존성 그래프에 PageRank 변형을 적용해
 * 이상 신호의 연쇄 전파를 시뮬레이션한다.
 */

export interface GraphNode {
  id: string
}

export interface GraphEdge {
  from: string
  to: string
  weight: number
}

export interface PropagationOptions {
  maxIterations?: number
  alpha?: number
  epsilon?: number
  topK?: number
}

export interface PropagationResult {
  iterations: number
  converged: boolean
  scores: Record<string, number>
  topK: Array<{ nodeId: string; score: number }>
}

export interface GraphAuditEntry {
  timestamp: string
  action: 'addNode' | 'addEdge' | 'setScore' | 'propagate'
  detail?: Record<string, unknown>
}

export class GraphAnomalyPropagator {
  private readonly nodes = new Set<string>()
  private readonly adjacency = new Map<string, Array<{ to: string; weight: number }>>()
  private readonly initialScores = new Map<string, number>()
  private readonly auditLog: GraphAuditEntry[] = []

  /**
   * CSAP D-06: 감사 로그 조회 (append-only).
   */
  getAuditLog(): readonly GraphAuditEntry[] {
    return this.auditLog
  }

  private recordAudit(
    action: GraphAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail ? { detail } : {}),
    })
  }

  /**
   * FR-R101.1: 노드 등록.
   */
  addNode(id: string): void {
    const existed = this.nodes.has(id)
    this.nodes.add(id)
    if (!this.adjacency.has(id)) {
      this.adjacency.set(id, [])
    }
    if (!this.initialScores.has(id)) {
      this.initialScores.set(id, 0)
    }
    if (!existed) {
      this.recordAudit('addNode', { id })
    }
  }

  /**
   * FR-R101.1: 에지 등록.
   */
  addEdge(from: string, to: string, weight = 1): void {
    this.addNode(from)
    this.addNode(to)
    this.adjacency.get(from)!.push({ to, weight })
    this.recordAudit('addEdge', { from, to, weight })
  }

  /**
   * FR-R101.2: 초기 이상 점수 설정.
   */
  setScore(id: string, score: number): void {
    this.addNode(id)
    this.initialScores.set(id, score)
    this.recordAudit('setScore', { id, score })
  }

  /**
   * FR-R101.3, FR-R101.5: 반복 전파 + 수렴 탐지.
   */
  propagate(opts: PropagationOptions = {}): PropagationResult {
    const maxIterations = opts.maxIterations ?? 50
    const alpha = opts.alpha ?? 0.85
    const epsilon = opts.epsilon ?? 1e-4
    const topK = opts.topK ?? 5

    const ids = Array.from(this.nodes)
    let scores = new Map<string, number>()
    for (const id of ids) {
      scores.set(id, this.initialScores.get(id) ?? 0)
    }

    // outDegree (가중치 합)
    const outWeights = new Map<string, number>()
    for (const id of ids) {
      const edges = this.adjacency.get(id) ?? []
      outWeights.set(
        id,
        edges.reduce((acc, e) => acc + e.weight, 0),
      )
    }

    let iteration = 0
    let converged = false
    for (; iteration < maxIterations; iteration++) {
      const next = new Map<string, number>()
      for (const id of ids) {
        next.set(id, (1 - alpha) * (this.initialScores.get(id) ?? 0))
      }
      for (const from of ids) {
        const edges = this.adjacency.get(from) ?? []
        const outW = outWeights.get(from) ?? 0
        if (outW === 0) continue
        const srcScore = scores.get(from) ?? 0
        for (const edge of edges) {
          const contribution = alpha * srcScore * (edge.weight / outW)
          next.set(edge.to, (next.get(edge.to) ?? 0) + contribution)
        }
      }

      // 수렴 검사
      let maxDelta = 0
      for (const id of ids) {
        const delta = Math.abs((next.get(id) ?? 0) - (scores.get(id) ?? 0))
        if (delta > maxDelta) maxDelta = delta
      }
      scores = next
      if (maxDelta < epsilon) {
        converged = true
        iteration++
        break
      }
    }

    // FR-R101.4: top-k
    const sorted = Array.from(scores.entries())
      .map(([nodeId, score]) => ({ nodeId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    const result: PropagationResult = {
      iterations: iteration,
      converged,
      scores: Object.fromEntries(scores),
      topK: sorted,
    }
    this.recordAudit('propagate', {
      iterations: iteration,
      converged,
      topKCount: sorted.length,
    })
    return result
  }
}
