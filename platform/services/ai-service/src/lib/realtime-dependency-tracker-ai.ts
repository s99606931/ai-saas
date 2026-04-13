// Design Ref: §R433 — AI기반 실시간 서비스 종속성 추적
// Plan SC: SVC-AI-ADV-R433-SC01

export type DependencyStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'
export type AlertLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ServiceNode {
  serviceId: string
  name: string
  critical: boolean
}

export interface DependencyLink {
  fromServiceId: string
  toServiceId: string
  weight: number    // 1..10 (높을수록 강한 의존)
}

export interface HealthUpdate {
  serviceId: string
  status: DependencyStatus
  timestamp: number
  latencyMs?: number
  errorRate?: number
}

export interface DependencyAlert {
  affectedServiceId: string
  rootCauseServiceId: string
  alertLevel: AlertLevel
  impactedServices: string[]
  detail: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class RealtimeDependencyTrackerAI {
  private nodes = new Map<string, ServiceNode>()
  private links: DependencyLink[] = []
  private healthHistory = new Map<string, HealthUpdate[]>()
  private auditLog: AuditEntry[] = []

  registerNode(node: ServiceNode): void {
    this.nodes.set(node.serviceId, node)
    this.appendAudit('node.register', node.serviceId, { name: node.name, critical: node.critical })
  }

  addLink(link: DependencyLink): void {
    if (!this.nodes.has(link.fromServiceId)) throw new Error(`Unknown service: ${link.fromServiceId}`)
    if (!this.nodes.has(link.toServiceId)) throw new Error(`Unknown service: ${link.toServiceId}`)
    this.links.push(link)
  }

  updateHealth(update: HealthUpdate): void {
    const list = this.healthHistory.get(update.serviceId) ?? []
    list.push(update)
    this.healthHistory.set(update.serviceId, list)
    this.appendAudit('health.update', update.serviceId, { status: update.status, latencyMs: update.latencyMs })
  }

  getAlerts(): DependencyAlert[] {
    const alerts: DependencyAlert[] = []

    for (const [serviceId, history] of this.healthHistory.entries()) {
      if (history.length === 0) continue
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const latest = history[history.length - 1]!
      // history.length > 0 guaranteed by the continue guard above

      if (latest.status === 'HEALTHY') continue

      const node = this.nodes.get(serviceId)
      if (!node) continue

      // 이 서비스에 의존하는 서비스들 탐색 (업스트림 영향)
      const dependents = this.links
        .filter((l) => l.toServiceId === serviceId)
        .map((l) => l.fromServiceId)
        .filter((id) => this.nodes.has(id))

      const alertLevel: AlertLevel =
        latest.status === 'DOWN' && node.critical ? 'CRITICAL'
          : latest.status === 'DOWN' ? 'HIGH'
          : latest.status === 'DEGRADED' && node.critical ? 'HIGH'
          : latest.status === 'DEGRADED' ? 'MEDIUM'
          : 'LOW'

      alerts.push({
        affectedServiceId: serviceId,
        rootCauseServiceId: serviceId,
        alertLevel,
        impactedServices: dependents,
        detail: `${node.name} 서비스 ${latest.status} — ${dependents.length}개 서비스 영향`,
      })
    }

    this.appendAudit('alerts.get', 'system', { alertCount: alerts.length })
    return alerts
  }

  getCurrentStatus(serviceId: string): DependencyStatus {
    const history = this.healthHistory.get(serviceId)
    if (!history || history.length === 0) return 'UNKNOWN'
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return history[history.length - 1]!.status
    // history.length > 0 guaranteed by the check above
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
