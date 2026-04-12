/**
 * AI 장애 근본 원인 분석 v2 (RCA Engine v2) — SVC-AI-ADV-R128
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R128/SVC-AI-ADV-R128.design.md
 * Plan SC: FR-R128.1 ~ FR-R128.6
 *
 * 기존 rca-engine.ts 개선: 인과관계 그래프 + LLM 심층 분석 인터페이스.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type NodeType = 'service' | 'pod' | 'node' | 'database' | 'queue' | 'external'
export type EdgeType = 'calls' | 'depends_on' | 'hosted_on' | 'reads_from' | 'writes_to'

export interface GraphNode {
  id: string
  type: NodeType
  name: string
  metadata?: Record<string, unknown>
}

export interface GraphEdge {
  from: string
  to: string
  type: EdgeType
  latencyMs?: number
  errorRate?: number
}

export interface Symptom {
  nodeId: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: string
  grade: DataGrade
}

export interface CausalChain {
  rootNodeId: string
  chain: string[]           // ordered node IDs from root to affected
  confidence: number        // 0~1
  explanation: string
}

export interface RcaV2Result {
  incidentId: string
  analyzedAt: string
  symptoms: Symptom[]
  causalChains: CausalChain[]
  topCause: CausalChain | null
  llmSummary?: string        // optional: if LLM provider injected
  remediations: string[]
}

export interface LlmProvider {
  summarize(prompt: string): Promise<string>
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

export class RcaEngineV2 {
  private readonly nodes = new Map<string, GraphNode>()
  private readonly edges: GraphEdge[] = []
  private readonly auditLog: AuditEntry[] = []
  private llmProvider?: LlmProvider

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  setLlmProvider(provider: LlmProvider): void {
    this.llmProvider = provider
    this.audit('setLlmProvider')
  }

  // Plan SC: FR-R128.1 — build causal graph
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node)
    this.audit('addNode', { id: node.id, type: node.type })
  }

  addEdge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.from)) throw new Error(`unknown node: ${edge.from}`)
    if (!this.nodes.has(edge.to)) throw new Error(`unknown node: ${edge.to}`)
    this.edges.push(edge)
    this.audit('addEdge', { from: edge.from, to: edge.to, type: edge.type })
  }

  // Plan SC: FR-R128.2 — upstream traversal for causal chain
  private findUpstream(nodeId: string, visited = new Set<string>()): string[] {
    if (visited.has(nodeId)) return []
    visited.add(nodeId)
    const upstream: string[] = []
    for (const edge of this.edges) {
      if (edge.to === nodeId) {
        upstream.push(edge.from)
        upstream.push(...this.findUpstream(edge.from, visited))
      }
    }
    return upstream
  }

  // Plan SC: FR-R128.3 — edge score (high error rate / latency → more suspicious)
  private edgeScore(from: string, to: string): number {
    const edge = this.edges.find(e => e.from === from && e.to === to)
    if (!edge) return 0
    const errorScore = (edge.errorRate ?? 0) * 60
    const latencyScore = Math.min(40, ((edge.latencyMs ?? 0) / 5000) * 40)
    return errorScore + latencyScore
  }

  // Plan SC: FR-R128.4
  private buildCausalChain(symptom: Symptom): CausalChain {
    const upstream = this.findUpstream(symptom.nodeId)
    if (upstream.length === 0) {
      return {
        rootNodeId: symptom.nodeId,
        chain: [symptom.nodeId],
        confidence: 0.5,
        explanation: `단일 노드 장애: ${symptom.nodeId}`,
      }
    }

    // Score each upstream node
    const scores = upstream.map(nodeId => {
      const score = this.edgeScore(nodeId, symptom.nodeId) +
        this.edges.filter(e => e.from === nodeId).reduce((s, e) => s + (e.errorRate ?? 0) * 40, 0)
      return { nodeId, score }
    })
    scores.sort((a, b) => b.score - a.score)
    const root = scores[0]!

    const chainPath = [root.nodeId]
    let current = root.nodeId
    while (current !== symptom.nodeId) {
      const next = this.edges.find(e => e.from === current && (upstream.includes(e.to) || e.to === symptom.nodeId))
      if (!next) break
      chainPath.push(next.to)
      current = next.to
    }
    if (!chainPath.includes(symptom.nodeId)) chainPath.push(symptom.nodeId)

    const maxPossibleScore = 100
    const confidence = Math.min(0.95, Math.max(0.3, root.score / maxPossibleScore))
    const rootNode = this.nodes.get(root.nodeId)
    return {
      rootNodeId: root.nodeId,
      chain: chainPath,
      confidence: Math.round(confidence * 100) / 100,
      explanation: `${rootNode?.name ?? root.nodeId}(${rootNode?.type})에서 장애 시작 → ${symptom.nodeId}까지 전파`,
    }
  }

  // Plan SC: FR-R128.5 — remediations based on root node type
  private buildRemediations(chains: CausalChain[]): string[] {
    const remediations = new Set<string>()
    for (const chain of chains) {
      const node = this.nodes.get(chain.rootNodeId)
      if (!node) continue
      if (node.type === 'pod') remediations.add('파드 재시작 및 OOMKill 로그 확인')
      if (node.type === 'database') remediations.add('DB 연결 풀 상태 및 슬로우 쿼리 확인')
      if (node.type === 'external') remediations.add('외부 서비스 헬스체크 및 서킷브레이커 적용')
      if (node.type === 'node') remediations.add('노드 리소스 사용량 확인 및 파드 재스케줄')
      if (node.type === 'queue') remediations.add('메시지 큐 깊이 및 컨슈머 상태 확인')
      if (node.type === 'service') remediations.add('서비스 배포 히스토리 확인 및 롤백 검토')
    }
    return [...remediations]
  }

  // Plan SC: FR-R128.6
  async analyze(incidentId: string, symptoms: Symptom[]): Promise<RcaV2Result> {
    for (const s of symptoms) {
      if (s.grade === DataGrade.C || s.grade === DataGrade.S) {
        throw new Error(`BLOCKED: ${s.grade}등급 증상 데이터 분석 금지 (N2SF N-05)`)
      }
    }

    const causalChains = symptoms.map(s => this.buildCausalChain(s))
    causalChains.sort((a, b) => b.confidence - a.confidence)
    const topCause = causalChains[0] ?? null

    const remediations = this.buildRemediations(causalChains)

    let llmSummary: string | undefined
    if (this.llmProvider && topCause) {
      const prompt = `장애 분석 결과: 근본 원인=${topCause.rootNodeId}, 경로=${topCause.chain.join('→')}, 설명=${topCause.explanation}. 간결한 운영팀 조치 요약 작성.`
      llmSummary = await this.llmProvider.summarize(prompt)
    }

    this.audit('analyze', { incidentId, symptoms: symptoms.length, chains: causalChains.length })
    return {
      incidentId,
      analyzedAt: new Date().toISOString(),
      symptoms,
      causalChains,
      topCause,
      ...(llmSummary !== undefined ? { llmSummary } : {}),
      remediations,
    }
  }
}
