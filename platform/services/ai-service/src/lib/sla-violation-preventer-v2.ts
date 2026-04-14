// Design Ref: §R489 — AI기반 서비스 SLA 위반 예방 v2
// Plan SC: SVC-AI-ADV-R489-SC01

export type SLATier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'
export type AlertLevel = 'OK' | 'WARNING' | 'CRITICAL'

export interface SLAContract {
  contractId: string
  serviceId: string
  tier: SLATier
  targetAvailabilityPct: number   // 예: 99.9
  maxResponseTimeMs: number
  maxIncidentsPerMonth: number
  penaltyPerViolationKrw: number
}

export interface ServiceMetric {
  metricId: string
  serviceId: string
  timestamp: number
  availabilityPct: number
  responseTimeMs: number
  errorRatePct: number
}

export interface SLAAlert {
  alertId: string
  contractId: string
  serviceId: string
  level: AlertLevel
  metric: 'AVAILABILITY' | 'RESPONSE_TIME' | 'ERROR_RATE'
  currentValue: number
  thresholdValue: number
  predictedViolation: boolean
  detail: string
}

export interface SLAPreventionReport {
  contractId: string
  serviceId: string
  alerts: SLAAlert[]
  currentAvailabilityPct: number
  currentResponseTimeMs: number
  violationRisk: AlertLevel
  estimatedPenaltyKrw: number
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  contractId: string
  detail: Record<string, unknown>
}

export class SLAViolationPreventerV2 {
  private contracts = new Map<string, SLAContract>()
  private metrics = new Map<string, ServiceMetric[]>()   // serviceId → metrics
  private auditLog: AuditEntry[] = []

  registerContract(contract: SLAContract): void {
    this.contracts.set(contract.contractId, contract)
    this.appendAudit('contract.register', contract.contractId, { serviceId: contract.serviceId, tier: contract.tier })
  }

  ingestMetric(metric: ServiceMetric): void {
    const list = this.metrics.get(metric.serviceId) ?? []
    list.push(metric)
    this.metrics.set(metric.serviceId, list)
  }

  analyze(contractId: string): SLAPreventionReport {
    const contract = this.contracts.get(contractId)
    if (!contract) throw new Error(`Unknown contract: ${contractId}`)

    this.appendAudit('sla.analyze', contractId, { serviceId: contract.serviceId })

    const serviceMetrics = this.metrics.get(contract.serviceId) ?? []
    const recent = serviceMetrics.slice(-10)
    if (recent.length === 0) {
      return {
        contractId, serviceId: contract.serviceId, alerts: [],
        currentAvailabilityPct: 100, currentResponseTimeMs: 0,
        violationRisk: 'OK', estimatedPenaltyKrw: 0,
        recommendations: ['메트릭 데이터 없음 — 모니터링 에이전트 설치 필요'],
      }
    }

    const avgAvailability = recent.reduce((s, m) => s + m.availabilityPct, 0) / recent.length
    const avgResponseTime = recent.reduce((s, m) => s + m.responseTimeMs, 0) / recent.length
    const avgErrorRate = recent.reduce((s, m) => s + m.errorRatePct, 0) / recent.length

    const alerts: SLAAlert[] = []
    const recommendations: string[] = []

    this.checkAvailability(contractId, contract, avgAvailability, alerts, recommendations)
    this.checkResponseTime(contractId, contract, avgResponseTime, alerts, recommendations)

    // 오류율 검사 (5% 초과 = CRITICAL)
    if (avgErrorRate > 5) {
      alerts.push({
        alertId: `ALT-ERR-${contractId}`, contractId, serviceId: contract.serviceId,
        level: 'CRITICAL', metric: 'ERROR_RATE',
        currentValue: Math.round(avgErrorRate * 100) / 100, thresholdValue: 5,
        predictedViolation: true, detail: `오류율 ${avgErrorRate.toFixed(1)}% — 서비스 품질 저하`,
      })
    }

    const criticalAlerts = alerts.filter((a) => a.level === 'CRITICAL').length
    const violationRisk: AlertLevel = criticalAlerts > 0 ? 'CRITICAL' : alerts.length > 0 ? 'WARNING' : 'OK'
    const estimatedPenaltyKrw = criticalAlerts * contract.penaltyPerViolationKrw

    return {
      contractId, serviceId: contract.serviceId, alerts,
      currentAvailabilityPct: Math.round(avgAvailability * 100) / 100,
      currentResponseTimeMs: Math.round(avgResponseTime),
      violationRisk, estimatedPenaltyKrw, recommendations,
    }
  }

  private checkAvailability(
    contractId: string, contract: SLAContract, avgAvailability: number,
    alerts: SLAAlert[], recommendations: string[],
  ): void {
    const availWarningThreshold = contract.targetAvailabilityPct - 0.5
    if (avgAvailability < contract.targetAvailabilityPct) {
      alerts.push({
        alertId: `ALT-AVAIL-${contractId}`, contractId, serviceId: contract.serviceId,
        level: 'CRITICAL', metric: 'AVAILABILITY',
        currentValue: Math.round(avgAvailability * 100) / 100,
        thresholdValue: contract.targetAvailabilityPct, predictedViolation: true,
        detail: `가용성 ${avgAvailability.toFixed(2)}% — SLA 목표 ${contract.targetAvailabilityPct}% 미달`,
      })
      recommendations.push('가용성 SLA 위반 — 장애 원인 즉시 조사 및 이중화 강화')
    } else if (avgAvailability < availWarningThreshold + 0.5) {
      alerts.push({
        alertId: `ALT-AVAIL-WARN-${contractId}`, contractId, serviceId: contract.serviceId,
        level: 'WARNING', metric: 'AVAILABILITY',
        currentValue: Math.round(avgAvailability * 100) / 100, thresholdValue: availWarningThreshold,
        predictedViolation: avgAvailability < availWarningThreshold,
        detail: `가용성 ${avgAvailability.toFixed(2)}% — SLA 목표 근접`,
      })
    }
  }

  private checkResponseTime(
    contractId: string, contract: SLAContract, avgResponseTime: number,
    alerts: SLAAlert[], recommendations: string[],
  ): void {
    if (avgResponseTime > contract.maxResponseTimeMs) {
      alerts.push({
        alertId: `ALT-RT-${contractId}`, contractId,
        serviceId: contract.serviceId,
        level: 'CRITICAL', metric: 'RESPONSE_TIME',
        currentValue: Math.round(avgResponseTime),
        thresholdValue: contract.maxResponseTimeMs, predictedViolation: true,
        detail: `응답 시간 ${Math.round(avgResponseTime)}ms — SLA 한도 ${contract.maxResponseTimeMs}ms 초과`,
      })
      recommendations.push('응답 시간 SLA 위반 — 캐싱 또는 인프라 스케일아웃 즉시 적용')
    } else if (avgResponseTime > contract.maxResponseTimeMs * 0.8) {
      alerts.push({
        alertId: `ALT-RT-WARN-${contractId}`,
        contractId,
        serviceId: contract.serviceId,
        level: 'WARNING',
        metric: 'RESPONSE_TIME',
        currentValue: Math.round(avgResponseTime),
        thresholdValue: Math.round(contract.maxResponseTimeMs * 0.8),
        predictedViolation: false,
        detail: `응답 시간 ${Math.round(avgResponseTime)}ms — SLA 한도 80% 이상`,
      })
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, contractId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, contractId, detail })
  }
}
