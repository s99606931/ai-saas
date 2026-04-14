// Design Ref: §R492 — AI기반 지능형 장애 격리 v2
// Plan SC: SVC-AI-ADV-R492-SC01

export type FaultType = 'LATENCY' | 'ERROR_RATE' | 'MEMORY_LEAK' | 'CPU_SPIKE' | 'NETWORK_PARTITION' | 'DB_CONNECTION'
export type IsolationAction = 'CIRCUIT_BREAK' | 'THROTTLE' | 'FAILOVER' | 'SCALE_OUT' | 'RESTART' | 'NONE'
export type FaultStatus = 'DETECTED' | 'ISOLATING' | 'ISOLATED' | 'RECOVERING' | 'RESOLVED'

export interface ServiceHealth {
  serviceId: string
  timestamp: number
  latencyP99Ms: number
  errorRatePct: number
  cpuUsagePct: number
  memoryUsagePct: number
  activeConnections: number
}

export interface FaultEvent {
  faultId: string
  serviceId: string
  faultType: FaultType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detectedAt: number
  status: FaultStatus
  isolationAction: IsolationAction
  detail: string
}

export interface IsolationResult {
  faultId: string
  serviceId: string
  action: IsolationAction
  success: boolean
  detail: string
  recoveryEtaMs: number   // 예상 복구 시간 (ms)
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

// 장애 유형별 격리 전략
const ISOLATION_STRATEGY: Record<FaultType, IsolationAction> = {
  LATENCY: 'CIRCUIT_BREAK',
  ERROR_RATE: 'CIRCUIT_BREAK',
  MEMORY_LEAK: 'RESTART',
  CPU_SPIKE: 'SCALE_OUT',
  NETWORK_PARTITION: 'FAILOVER',
  DB_CONNECTION: 'THROTTLE',
}

const RECOVERY_ETA_MS: Record<IsolationAction, number> = {
  CIRCUIT_BREAK: 30_000,
  THROTTLE: 10_000,
  FAILOVER: 60_000,
  SCALE_OUT: 120_000,
  RESTART: 45_000,
  NONE: 0,
}

export class IntelligentFaultIsolatorV2 {
  private healthHistory = new Map<string, ServiceHealth[]>()
  private faultEvents = new Map<string, FaultEvent>()
  private auditLog: AuditEntry[] = []

  ingestHealth(health: ServiceHealth): void {
    const list = this.healthHistory.get(health.serviceId) ?? []
    list.push(health)
    this.healthHistory.set(health.serviceId, list)
  }

  detect(serviceId: string): FaultEvent[] {
    const history = this.healthHistory.get(serviceId) ?? []
    const recent = history.slice(-5)
    if (recent.length === 0) return []

    this.appendAudit('fault.detect', serviceId, { sampleCount: recent.length })

    const avgLatency = recent.reduce((s, h) => s + h.latencyP99Ms, 0) / recent.length
    const avgErrorRate = recent.reduce((s, h) => s + h.errorRatePct, 0) / recent.length
    const avgCpu = recent.reduce((s, h) => s + h.cpuUsagePct, 0) / recent.length
    const avgMemory = recent.reduce((s, h) => s + h.memoryUsagePct, 0) / recent.length

    const detectedFaults: FaultEvent[] = []
    const now = Date.now()

    if (avgLatency > 2000) {
      const fault: FaultEvent = {
        faultId: `FLT-LAT-${serviceId}-${now}`,
        serviceId,
        faultType: 'LATENCY',
        severity: avgLatency > 5000 ? 'CRITICAL' : 'HIGH',
        detectedAt: now,
        status: 'DETECTED',
        isolationAction: 'CIRCUIT_BREAK',
        detail: `P99 지연 ${Math.round(avgLatency)}ms — 임계값 2000ms 초과`,
      }
      this.faultEvents.set(fault.faultId, fault)
      detectedFaults.push(fault)
    }

    if (avgErrorRate > 5) {
      const fault: FaultEvent = {
        faultId: `FLT-ERR-${serviceId}-${now}`,
        serviceId,
        faultType: 'ERROR_RATE',
        severity: avgErrorRate > 20 ? 'CRITICAL' : 'HIGH',
        detectedAt: now,
        status: 'DETECTED',
        isolationAction: 'CIRCUIT_BREAK',
        detail: `오류율 ${avgErrorRate.toFixed(1)}% — 임계값 5% 초과`,
      }
      this.faultEvents.set(fault.faultId, fault)
      detectedFaults.push(fault)
    }

    if (avgMemory > 90) {
      const fault: FaultEvent = {
        faultId: `FLT-MEM-${serviceId}-${now}`,
        serviceId,
        faultType: 'MEMORY_LEAK',
        severity: 'HIGH',
        detectedAt: now,
        status: 'DETECTED',
        isolationAction: 'RESTART',
        detail: `메모리 사용률 ${Math.round(avgMemory)}% — 메모리 누수 의심`,
      }
      this.faultEvents.set(fault.faultId, fault)
      detectedFaults.push(fault)
    }

    if (avgCpu > 85) {
      const fault: FaultEvent = {
        faultId: `FLT-CPU-${serviceId}-${now}`,
        serviceId,
        faultType: 'CPU_SPIKE',
        severity: avgCpu > 95 ? 'CRITICAL' : 'MEDIUM',
        detectedAt: now,
        status: 'DETECTED',
        isolationAction: 'SCALE_OUT',
        detail: `CPU 사용률 ${Math.round(avgCpu)}% — 수평 확장 필요`,
      }
      this.faultEvents.set(fault.faultId, fault)
      detectedFaults.push(fault)
    }

    this.appendAudit('fault.detected', serviceId, { faultCount: detectedFaults.length })
    return detectedFaults
  }

  isolate(faultId: string): IsolationResult {
    const fault = this.faultEvents.get(faultId)
    if (!fault) throw new Error(`Unknown fault: ${faultId}`)

    const action = ISOLATION_STRATEGY[fault.faultType]
    fault.status = 'ISOLATING'
    this.faultEvents.set(faultId, fault)

    this.appendAudit('fault.isolate', fault.serviceId, { faultId, action, faultType: fault.faultType })

    const result: IsolationResult = {
      faultId,
      serviceId: fault.serviceId,
      action,
      success: true,
      detail: `${fault.faultType} 장애에 ${action} 격리 조치 적용`,
      recoveryEtaMs: RECOVERY_ETA_MS[action],
    }

    fault.status = 'ISOLATED'
    fault.isolationAction = action
    this.faultEvents.set(faultId, fault)

    return result
  }

  getActiveFaults(serviceId: string): FaultEvent[] {
    return Array.from(this.faultEvents.values()).filter(
      (f) => f.serviceId === serviceId && f.status !== 'RESOLVED',
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
