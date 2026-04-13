// Design Ref: §R334 — AI기반 에러 버짓 자동 관리
// Plan SC: SC-R334

export interface SloDefinition {
  sloId: string
  serviceId: string
  targetSuccessRate: number
  windowDays: number
}

export interface SloMeasurement {
  sloId: string
  timestamp: number
  totalRequests: number
  successfulRequests: number
}

export type BudgetStatus = 'HEALTHY' | 'WARNING' | 'EXHAUSTED'

export interface ErrorBudgetReport {
  sloId: string
  serviceId: string
  targetSuccessRate: number
  currentSuccessRate: number
  errorBudgetPercent: number
  remainingBudgetPercent: number
  budgetStatus: BudgetStatus
  burnRate: number
  projectedExhaustionDays: number | null
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ErrorBudgetManagerAi {
  private slos = new Map<string, SloDefinition>()
  private measurements = new Map<string, SloMeasurement[]>()
  private auditLog: AuditEntry[] = []

  registerSlo(slo: SloDefinition): void {
    this.slos.set(slo.sloId, slo)
    this.measurements.set(slo.sloId, [])
    this.auditLog.push({ action: 'slo.register', timestamp: new Date().toISOString(), detail: slo.sloId })
  }

  recordMeasurement(measurement: SloMeasurement): void {
    if (!this.slos.has(measurement.sloId)) throw new Error(`SLO not found: ${measurement.sloId}`)
    this.measurements.get(measurement.sloId)!.push(measurement)
    this.auditLog.push({ action: 'slo.measure', timestamp: new Date().toISOString(), detail: measurement.sloId })
  }

  report(sloId: string): ErrorBudgetReport {
    const slo = this.slos.get(sloId)
    if (!slo) throw new Error(`SLO not found: ${sloId}`)

    const records = this.measurements.get(sloId) ?? []
    const totalRequests = records.reduce((s, r) => s + r.totalRequests, 0)
    const successfulRequests = records.reduce((s, r) => s + r.successfulRequests, 0)

    const currentSuccessRate = totalRequests > 0 ? successfulRequests / totalRequests : 1.0
    const allowedErrorRate = 1 - slo.targetSuccessRate
    const actualErrorRate = 1 - currentSuccessRate
    const errorBudgetPercent = allowedErrorRate * 100
    const usedBudgetPercent = allowedErrorRate > 0 ? (actualErrorRate / allowedErrorRate) * 100 : 0
    const remainingBudgetPercent = Math.max(0, 100 - usedBudgetPercent)

    let budgetStatus: BudgetStatus
    if (remainingBudgetPercent <= 0) {
      budgetStatus = 'EXHAUSTED'
    } else if (remainingBudgetPercent <= 25) {
      budgetStatus = 'WARNING'
    } else {
      budgetStatus = 'HEALTHY'
    }

    // burn rate: 현재 에러율 / 허용 에러율 (1이면 정상 소모)
    const burnRate = allowedErrorRate > 0 ? actualErrorRate / allowedErrorRate : 0

    let projectedExhaustionDays: number | null = null
    if (burnRate > 1 && records.length > 0) {
      projectedExhaustionDays = Math.round(slo.windowDays * (remainingBudgetPercent / 100) / (burnRate - 1))
      if (projectedExhaustionDays < 0) projectedExhaustionDays = 0
    }

    const recommendations: string[] = []
    if (budgetStatus === 'EXHAUSTED') {
      recommendations.push('에러 버짓 소진 — 즉시 릴리즈 동결 및 장애 대응')
    } else if (budgetStatus === 'WARNING') {
      recommendations.push('에러 버짓 25% 이하 — 릴리즈 속도 조절')
    }
    if (burnRate > 2) {
      recommendations.push(`Burn rate ${burnRate.toFixed(1)}x 초과 — 즉각 조치 필요`)
    }

    this.auditLog.push({ action: 'budget.report', timestamp: new Date().toISOString(), detail: `${sloId}:${budgetStatus}` })
    return {
      sloId,
      serviceId: slo.serviceId,
      targetSuccessRate: slo.targetSuccessRate,
      currentSuccessRate: Math.round(currentSuccessRate * 10000) / 10000,
      errorBudgetPercent,
      remainingBudgetPercent: Math.round(remainingBudgetPercent * 10) / 10,
      budgetStatus,
      burnRate: Math.round(burnRate * 100) / 100,
      projectedExhaustionDays,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
