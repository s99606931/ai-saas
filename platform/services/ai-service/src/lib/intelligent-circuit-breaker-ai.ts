// Design Ref: §R521 — AI기반 지능형 서비스 회로 차단기
// Plan SC: SVC-AI-ADV-R521-SC01

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitConfig {
  serviceId: string
  failureThresholdPct: number    // 실패율 임계값 (예: 50 = 50%)
  slowCallThresholdMs: number    // 느린 호출 임계값 (ms)
  slowCallRatePct: number        // 느린 호출 비율 임계값 (%)
  windowSize: number             // 평가 윈도우 (호출 횟수)
  openDurationMs: number         // OPEN 유지 시간 (ms)
  halfOpenMaxCalls: number       // HALF_OPEN 상태 최대 테스트 호출
}

export interface CallRecord {
  callId: string
  serviceId: string
  timestamp: number
  durationMs: number
  success: boolean
}

export interface CircuitStatus {
  serviceId: string
  state: CircuitState
  failureRatePct: number
  slowCallRatePct: number
  totalCalls: number
  openedAt?: number
  reason?: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class IntelligentCircuitBreakerAI {
  private configs = new Map<string, CircuitConfig>()
  private calls = new Map<string, CallRecord[]>()   // serviceId → calls
  private states = new Map<string, CircuitState>()
  private openedAt = new Map<string, number>()
  private halfOpenCalls = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerConfig(config: CircuitConfig): void {
    this.configs.set(config.serviceId, config)
    this.states.set(config.serviceId, 'CLOSED')
    this.appendAudit('config.register', config.serviceId, { failureThresholdPct: config.failureThresholdPct })
  }

  recordCall(call: CallRecord): void {
    const list = this.calls.get(call.serviceId) ?? []
    list.push(call)
    this.calls.set(call.serviceId, list)

    const config = this.configs.get(call.serviceId)
    if (!config) return

    const state = this.states.get(call.serviceId) ?? 'CLOSED'

    if (state === 'HALF_OPEN') {
      const halfOpen = (this.halfOpenCalls.get(call.serviceId) ?? 0) + 1
      this.halfOpenCalls.set(call.serviceId, halfOpen)

      if (!call.success) {
        this.states.set(call.serviceId, 'OPEN')
        this.openedAt.set(call.serviceId, call.timestamp)
        this.appendAudit('circuit.open', call.serviceId, { reason: 'HALF_OPEN 테스트 실패' })
        return
      }

      if (halfOpen >= config.halfOpenMaxCalls) {
        this.states.set(call.serviceId, 'CLOSED')
        this.halfOpenCalls.delete(call.serviceId)
        this.appendAudit('circuit.close', call.serviceId, { reason: 'HALF_OPEN 테스트 통과' })
      }
      return
    }

    // OPEN 상태에서 복구 대기 시간 확인
    if (state === 'OPEN') {
      const openTime = this.openedAt.get(call.serviceId) ?? 0
      if (call.timestamp - openTime >= config.openDurationMs) {
        this.states.set(call.serviceId, 'HALF_OPEN')
        this.halfOpenCalls.set(call.serviceId, 0)
        this.appendAudit('circuit.half-open', call.serviceId, {})
      }
      return
    }

    // CLOSED 상태에서 윈도우 기반 평가
    const window = list.slice(-config.windowSize)
    if (window.length < config.windowSize) return

    const failures = window.filter((c) => !c.success).length
    const failureRatePct = (failures / window.length) * 100
    const slowCalls = window.filter((c) => c.durationMs > config.slowCallThresholdMs).length
    const slowRatePct = (slowCalls / window.length) * 100

    if (failureRatePct >= config.failureThresholdPct || slowRatePct >= config.slowCallRatePct) {
      this.states.set(call.serviceId, 'OPEN')
      this.openedAt.set(call.serviceId, call.timestamp)
      const reason = failureRatePct >= config.failureThresholdPct
        ? `실패율 ${failureRatePct.toFixed(0)}%`
        : `느린 호출 비율 ${slowRatePct.toFixed(0)}%`
      this.appendAudit('circuit.open', call.serviceId, { reason, failureRatePct, slowRatePct })
    }
  }

  getStatus(serviceId: string): CircuitStatus {
    const config = this.configs.get(serviceId)
    if (!config) throw new Error(`Unknown service: ${serviceId}`)

    const state = this.states.get(serviceId) ?? 'CLOSED'
    const allCalls = this.calls.get(serviceId) ?? []
    const window = allCalls.slice(-config.windowSize)

    const failures = window.filter((c) => !c.success).length
    const failureRatePct = window.length > 0 ? (failures / window.length) * 100 : 0
    const slowCalls = window.filter((c) => c.durationMs > config.slowCallThresholdMs).length
    const slowCallRatePct = window.length > 0 ? (slowCalls / window.length) * 100 : 0

    return {
      serviceId,
      state,
      failureRatePct: Math.round(failureRatePct),
      slowCallRatePct: Math.round(slowCallRatePct),
      totalCalls: allCalls.length,
      openedAt: this.openedAt.get(serviceId),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
