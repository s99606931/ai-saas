// Design Ref: §R200 — AI기반 서버 리소스 자동 스케일링
// Plan SC: SVC-AI-ADV-R200-SC01

export type ResourceType = 'CPU' | 'MEMORY' | 'STORAGE' | 'NETWORK'
export type ScalingAction = 'SCALE_UP' | 'SCALE_DOWN' | 'NO_CHANGE'

export interface NodeConfig {
  nodeId: string
  name: string
  maxCpu: number  // percentage
  maxMemory: number  // GB
  currentReplicas: number
  minReplicas: number
  maxReplicas: number
}

export interface ResourceSnapshot {
  nodeId: string
  timestamp: number
  cpuUsage: number    // percentage
  memoryUsage: number // percentage
  networkMbps: number
}

export interface ScalingDecision {
  nodeId: string
  action: ScalingAction
  resourceType: ResourceType
  currentValue: number
  threshold: number
  newReplicas: number
  reason: string
}

interface AuditEntry {
  timestamp: string
  action: string
  nodeId: string
  detail: Record<string, unknown>
}

const SCALE_UP_THRESHOLD = 80   // % usage → scale up
const SCALE_DOWN_THRESHOLD = 30  // % usage → scale down

export class ResourceAutoscalingAi {
  private nodes = new Map<string, NodeConfig>()
  private snapshots = new Map<string, ResourceSnapshot[]>()
  private decisions: ScalingDecision[] = []
  private auditLog: AuditEntry[] = []

  registerNode(config: NodeConfig): void {
    this.nodes.set(config.nodeId, config)
    this.snapshots.set(config.nodeId, [])
    this.appendAudit('node.register', config.nodeId, { name: config.name })
  }

  recordSnapshot(snapshot: ResourceSnapshot): void {
    if (!this.nodes.has(snapshot.nodeId)) throw new Error(`Unknown node: ${snapshot.nodeId}`)
    const list = this.snapshots.get(snapshot.nodeId) ?? []
    list.push(snapshot)
    this.snapshots.set(snapshot.nodeId, list)
  }

  evaluate(nodeId: string): ScalingDecision {
    const node = this.nodes.get(nodeId)
    if (!node) throw new Error(`Unknown node: ${nodeId}`)

    const history = this.snapshots.get(nodeId) ?? []
    if (history.length === 0) {
      const decision: ScalingDecision = {
        nodeId,
        action: 'NO_CHANGE',
        resourceType: 'CPU',
        currentValue: 0,
        threshold: SCALE_UP_THRESHOLD,
        newReplicas: node.currentReplicas,
        reason: '스냅샷 데이터 없음',
      }
      this.decisions.push(decision)
      return decision
    }

    const recent = history.slice(-3)
    const avgCpu = recent.reduce((s, r) => s + r.cpuUsage, 0) / recent.length
    const avgMemory = recent.reduce((s, r) => s + r.memoryUsage, 0) / recent.length

    let action: ScalingAction = 'NO_CHANGE'
    let resourceType: ResourceType = 'CPU'
    let currentValue = avgCpu
    let newReplicas = node.currentReplicas
    let reason = '정상 범위'

    if (avgCpu >= SCALE_UP_THRESHOLD || avgMemory >= SCALE_UP_THRESHOLD) {
      action = 'SCALE_UP'
      resourceType = avgCpu >= avgMemory ? 'CPU' : 'MEMORY'
      currentValue = resourceType === 'CPU' ? avgCpu : avgMemory
      newReplicas = Math.min(node.currentReplicas + 1, node.maxReplicas)
      reason = `${resourceType} 사용률 ${Math.round(currentValue)}% — 스케일 업`
    } else if (avgCpu <= SCALE_DOWN_THRESHOLD && avgMemory <= SCALE_DOWN_THRESHOLD) {
      action = 'SCALE_DOWN'
      currentValue = avgCpu
      newReplicas = Math.max(node.currentReplicas - 1, node.minReplicas)
      reason = `CPU/메모리 사용률 낮음 — 스케일 다운`
    }

    const decision: ScalingDecision = {
      nodeId,
      action,
      resourceType,
      currentValue: Math.round(currentValue),
      threshold: action === 'SCALE_UP' ? SCALE_UP_THRESHOLD : SCALE_DOWN_THRESHOLD,
      newReplicas,
      reason,
    }

    this.decisions.push(decision)
    this.appendAudit('scaling.evaluate', nodeId, { action, newReplicas, reason })
    return decision
  }

  getDecisions(nodeId?: string): ScalingDecision[] {
    if (nodeId) return this.decisions.filter((d) => d.nodeId === nodeId)
    return [...this.decisions]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, nodeId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, nodeId, detail })
  }
}
