// Design Ref: §R271 — AI기반 지능형 장애 격리 v2
// Plan SC: SVC-AI-ADV-R271-SC01
// CSAP D-06: 감사 로그, D-12: 입력 검증

export type FaultType = 'TIMEOUT' | 'ERROR_SPIKE' | 'MEMORY_LEAK' | 'CPU_SPIKE' | 'NETWORK_PARTITION'
export type IsolationAction = 'ISOLATE' | 'THROTTLE' | 'RESTART' | 'SCALE_OUT' | 'NO_ACTION'
export type FaultSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ServiceHealth {
  serviceId: string
  name: string
  replicaCount: number
  maxReplicas: number
}

export interface FaultEvent {
  serviceId: string
  faultId: string
  faultType: FaultType
  severity: FaultSeverity
  errorRate: number   // 0~1
  cpuPercent: number  // 0~100
  memoryPercent: number  // 0~100
  timestamp: number
}

export interface IsolationDecision {
  serviceId: string
  faultType: FaultType
  action: IsolationAction
  severity: FaultSeverity
  affectedReplicas: number
  reason: string
  autoExecuted: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class IntelligentFaultIsolatorAi {
  private services = new Map<string, ServiceHealth>()
  private faultHistory = new Map<string, FaultEvent[]>()
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceHealth): void {
    this.services.set(service.serviceId, service)
    this.faultHistory.set(service.serviceId, [])
    this.appendAudit('service.register', service.serviceId, { name: service.name, replicaCount: service.replicaCount })
  }

  reportFault(fault: FaultEvent): IsolationDecision {
    const service = this.services.get(fault.serviceId)
    if (!service) throw new Error(`Unknown service: ${fault.serviceId}`)

    const history = this.faultHistory.get(fault.serviceId) ?? []
    history.push(fault)
    this.faultHistory.set(fault.serviceId, history)

    let action: IsolationAction = 'NO_ACTION'
    let reason = '장애 수준 정상 범위'
    let autoExecuted = false

    if (fault.severity === 'CRITICAL') {
      action = 'ISOLATE'
      reason = `CRITICAL 장애 (${fault.faultType}) — 즉시 격리`
      autoExecuted = true
    } else if (fault.faultType === 'MEMORY_LEAK' && fault.memoryPercent > 90) {
      action = 'RESTART'
      reason = `메모리 누수 ${fault.memoryPercent}% — 재시작 권고`
      autoExecuted = fault.severity === 'HIGH'
    } else if (fault.faultType === 'CPU_SPIKE' && fault.cpuPercent > 85) {
      action = 'SCALE_OUT'
      reason = `CPU 급증 ${fault.cpuPercent}% — 스케일아웃 권고`
      autoExecuted = service.replicaCount < service.maxReplicas
    } else if (fault.errorRate > 0.5) {
      action = 'ISOLATE'
      reason = `에러율 ${Math.round(fault.errorRate * 100)}% — 격리 권고`
      autoExecuted = fault.errorRate > 0.8
    } else if (fault.errorRate > 0.2) {
      action = 'THROTTLE'
      reason = `에러율 ${Math.round(fault.errorRate * 100)}% — 트래픽 제한 권고`
    }

    this.appendAudit('fault.isolate', fault.serviceId, { faultType: fault.faultType, action, severity: fault.severity })

    return {
      serviceId: fault.serviceId,
      faultType: fault.faultType,
      action,
      severity: fault.severity,
      affectedReplicas: service.replicaCount,
      reason,
      autoExecuted,
    }
  }

  getFaultHistory(serviceId: string): FaultEvent[] {
    if (!this.services.has(serviceId)) throw new Error(`Unknown service: ${serviceId}`)
    return [...(this.faultHistory.get(serviceId) ?? [])]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
