// Design Ref: §R360 — AI기반 자동 인프라 스케일링
// Plan SC: SC-R360

export interface InfraService {
  serviceId: string
  serviceName: string
  minReplicas: number
  maxReplicas: number
  currentReplicas: number
  targetCpuPercent: number
}

export interface InfraMetric {
  serviceId: string
  timestamp: number
  cpuPercent: number
  memoryPercent: number
  requestQueueDepth: number
}

export type ScalingAction = 'SCALE_UP' | 'SCALE_DOWN' | 'NO_CHANGE'

export interface ScalingDecision {
  serviceId: string
  currentReplicas: number
  recommendedReplicas: number
  action: ScalingAction
  reason: string
  urgency: 'IMMEDIATE' | 'GRADUAL' | 'NONE'
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class AutoInfraScalerAi {
  private services = new Map<string, InfraService>()
  private auditLog: AuditEntry[] = []

  registerService(service: InfraService): void {
    this.services.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  decide(metric: InfraMetric): ScalingDecision {
    const service = this.services.get(metric.serviceId)
    if (!service) throw new Error(`Service not found: ${metric.serviceId}`)

    let action: ScalingAction = 'NO_CHANGE'
    let recommendedReplicas = service.currentReplicas
    let reason: string
    let urgency: ScalingDecision['urgency'] = 'NONE'

    const cpuOverload = metric.cpuPercent > service.targetCpuPercent * 1.2
    const cpuUnderload = metric.cpuPercent < service.targetCpuPercent * 0.5
    const queueHigh = metric.requestQueueDepth > 100

    if (cpuOverload || queueHigh) {
      // 스케일 업 필요
      const factor = queueHigh ? 2 : 1.5
      recommendedReplicas = Math.min(service.maxReplicas, Math.ceil(service.currentReplicas * factor))
      if (recommendedReplicas > service.currentReplicas) {
        action = 'SCALE_UP'
        reason = queueHigh
          ? `요청 큐 ${metric.requestQueueDepth} — 즉시 스케일 업`
          : `CPU ${metric.cpuPercent}% 목표(${service.targetCpuPercent}%) 120% 초과`
        urgency = queueHigh ? 'IMMEDIATE' : 'GRADUAL'
      } else {
        reason = '이미 최대 레플리카 수에 도달'
      }
    } else if (cpuUnderload && metric.requestQueueDepth === 0) {
      // 스케일 다운
      recommendedReplicas = Math.max(service.minReplicas, Math.floor(service.currentReplicas * 0.7))
      if (recommendedReplicas < service.currentReplicas) {
        action = 'SCALE_DOWN'
        reason = `CPU ${metric.cpuPercent}% 목표(${service.targetCpuPercent}%) 50% 미만 + 큐 비어있음`
        urgency = 'GRADUAL'
      } else {
        reason = '이미 최소 레플리카 수에 도달'
      }
    } else {
      reason = `CPU ${metric.cpuPercent}% — 정상 범위`
    }

    this.auditLog.push({ action: 'infra.scale', timestamp: new Date().toISOString(), detail: `${metric.serviceId}:${action}` })
    return { serviceId: metric.serviceId, currentReplicas: service.currentReplicas, recommendedReplicas, action, reason, urgency }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
