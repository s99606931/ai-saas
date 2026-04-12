// Design Ref: §R234 — AI기반 서비스 메시 트래픽 최적화
// Plan SC: SVC-AI-ADV-R234-SC01

export type TrafficPolicy = 'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RANDOM' | 'PASSTHROUGH'
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface ServiceNode {
  nodeId: string
  name: string
  namespace: string
  currentPolicy: TrafficPolicy
}

export interface TrafficMetric {
  nodeId: string
  windowStart: number
  requestCount: number
  errorCount: number
  avgLatencyMs: number
  p99LatencyMs: number
}

export interface OptimizationResult {
  nodeId: string
  recommendedPolicy: TrafficPolicy
  circuitState: CircuitState
  reason: string
  retryBudget: number  // 0~100%
}

interface AuditEntry {
  timestamp: string
  action: string
  nodeId: string
  detail: Record<string, unknown>
}

const ERROR_RATE_CIRCUIT_OPEN = 0.5    // 50% 이상 에러 → CIRCUIT OPEN
const LATENCY_THRESHOLD_MS = 500       // 500ms 이상 → 정책 변경 권고

export class ServiceMeshTrafficOptimizer {
  private nodes = new Map<string, ServiceNode>()
  private metrics = new Map<string, TrafficMetric[]>()
  private auditLog: AuditEntry[] = []

  registerNode(node: ServiceNode): void {
    this.nodes.set(node.nodeId, node)
    this.metrics.set(node.nodeId, [])
    this.appendAudit('node.register', node.nodeId, { name: node.name, namespace: node.namespace })
  }

  recordMetric(metric: TrafficMetric): void {
    if (!this.nodes.has(metric.nodeId)) throw new Error(`Unknown node: ${metric.nodeId}`)
    const list = this.metrics.get(metric.nodeId) ?? []
    list.push(metric)
    this.metrics.set(metric.nodeId, list)
  }

  optimize(nodeId: string): OptimizationResult {
    const node = this.nodes.get(nodeId)
    if (!node) throw new Error(`Unknown node: ${nodeId}`)

    const history = this.metrics.get(nodeId) ?? []
    if (history.length === 0) {
      return {
        nodeId,
        recommendedPolicy: node.currentPolicy,
        circuitState: 'CLOSED',
        reason: '메트릭 데이터 없음 — 현재 정책 유지',
        retryBudget: 100,
      }
    }

    const recent = history.slice(-5)
    const totalRequests = recent.reduce((s, m) => s + m.requestCount, 0)
    const totalErrors = recent.reduce((s, m) => s + m.errorCount, 0)
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0
    const avgLatency = recent.reduce((s, m) => s + m.avgLatencyMs, 0) / recent.length

    let circuitState: CircuitState = 'CLOSED'
    let recommendedPolicy: TrafficPolicy = node.currentPolicy
    let reason = '정상 트래픽 상태'
    let retryBudget = 100

    if (errorRate >= ERROR_RATE_CIRCUIT_OPEN) {
      circuitState = 'OPEN'
      reason = `에러율 ${Math.round(errorRate * 100)}% — 서킷 브레이커 OPEN`
      retryBudget = 0
    } else if (errorRate >= 0.2) {
      circuitState = 'HALF_OPEN'
      reason = `에러율 ${Math.round(errorRate * 100)}% — 서킷 브레이커 HALF_OPEN`
      retryBudget = 25
    } else if (avgLatency > LATENCY_THRESHOLD_MS) {
      recommendedPolicy = 'LEAST_REQUEST'
      reason = `평균 지연 ${Math.round(avgLatency)}ms — LEAST_REQUEST 정책 권고`
    }

    this.appendAudit('traffic.optimize', nodeId, { circuitState, recommendedPolicy, errorRate: Math.round(errorRate * 100) / 100 })

    return { nodeId, recommendedPolicy, circuitState, reason, retryBudget }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, nodeId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, nodeId, detail })
  }
}
