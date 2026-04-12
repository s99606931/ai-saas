// Design Ref: §R208 — AI기반 서비스 레벨 목표 최적화
// Plan SC: SVC-AI-ADV-R208-SC01

export interface SloDefinition {
  sloId: string
  serviceName: string
  targetAvailability: number  // 0~1 (e.g. 0.999)
  targetLatencyMs: number
  targetErrorRate: number     // 0~1
}

export interface ServiceMetrics {
  sloId: string
  windowStart: string
  windowEnd: string
  measuredAvailability: number
  measuredLatencyMs: number
  measuredErrorRate: number
}

export interface SloOptimization {
  sloId: string
  currentBudgetRemaining: number  // 0~1 (error budget)
  burnRate: number
  atRisk: boolean
  adjustedTargets?: { availability: number; latencyMs: number; errorRate: number }
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  sloId: string
  detail: Record<string, unknown>
}

export class SloOptimizerAI {
  private definitions = new Map<string, SloDefinition>()
  private metricsHistory = new Map<string, ServiceMetrics[]>()
  private auditLog: AuditEntry[] = []

  registerSlo(slo: SloDefinition): void {
    this.definitions.set(slo.sloId, slo)
    this.metricsHistory.set(slo.sloId, [])
    this.appendAudit('slo.register', slo.sloId, { serviceName: slo.serviceName })
  }

  recordMetrics(metrics: ServiceMetrics): void {
    if (!this.definitions.has(metrics.sloId)) throw new Error(`Unknown SLO: ${metrics.sloId}`)
    const history = this.metricsHistory.get(metrics.sloId) ?? []
    history.push(metrics)
    this.metricsHistory.set(metrics.sloId, history)
  }

  optimize(sloId: string): SloOptimization {
    const slo = this.definitions.get(sloId)
    if (!slo) throw new Error(`Unknown SLO: ${sloId}`)

    const history = this.metricsHistory.get(sloId) ?? []
    const recommendations: string[] = []

    if (history.length === 0) {
      return {
        sloId,
        currentBudgetRemaining: 1,
        burnRate: 0,
        atRisk: false,
        recommendations: ['메트릭 데이터 부족 — 수집 시작 필요'],
      }
    }

    const recent = history[history.length - 1]!
    const errorBudget = 1 - slo.targetAvailability
    const consumedBudget = Math.max(0, (1 - recent.measuredAvailability) - errorBudget)
    const budgetRemaining = Math.max(0, 1 - consumedBudget / Math.max(errorBudget, 0.0001))
    const burnRate = history.length > 1
      ? consumedBudget / history.length
      : consumedBudget

    const atRisk = budgetRemaining < 0.2 || burnRate > 0.1

    if (recent.measuredLatencyMs > slo.targetLatencyMs) {
      recommendations.push(`레이턴시 초과 (${recent.measuredLatencyMs}ms > ${slo.targetLatencyMs}ms) — 캐시 또는 쿼리 최적화 권장`)
    }
    if (recent.measuredErrorRate > slo.targetErrorRate) {
      recommendations.push(`에러율 초과 (${(recent.measuredErrorRate * 100).toFixed(1)}%) — 배포 롤백 또는 회로 차단기 활성화 검토`)
    }
    if (atRisk) {
      recommendations.push('에러 예산 20% 미만 — 기능 배포 동결 권장')
    }

    this.appendAudit('slo.optimize', sloId, { budgetRemaining, burnRate, atRisk })

    return {
      sloId,
      currentBudgetRemaining: budgetRemaining,
      burnRate,
      atRisk,
      recommendations,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, sloId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, sloId, detail })
  }
}
