// Design Ref: §R374 — AI기반 실시간 서비스 품질 보증
// Plan SC: SVC-AI-ADV-R374-SC01

export type QualityLevel = 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'UNACCEPTABLE'
export type SLAStatus = 'WITHIN_SLA' | 'AT_RISK' | 'SLA_BREACH'

export interface ServiceSLA {
  serviceId: string
  maxLatencyMs: number
  minSuccessRate: number  // 0..1
  maxErrorRate: number    // 0..1
  minAvailability: number // 0..1
}

export interface QualityMeasurement {
  serviceId: string
  latencyMs: number
  successRate: number  // 0..1
  errorRate: number    // 0..1
  requestsPerSec: number
  timestamp: number
}

export interface QualityReport {
  serviceId: string
  qualityLevel: QualityLevel
  slaStatus: SLAStatus
  qualityScore: number  // 0..100
  breachedSLAs: string[]
  atRiskSLAs: string[]
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class RealtimeServiceQualityAssurer {
  private slas = new Map<string, ServiceSLA>()
  private measurements = new Map<string, QualityMeasurement[]>()
  private auditLog: AuditEntry[] = []

  registerSLA(sla: ServiceSLA): void {
    this.slas.set(sla.serviceId, sla)
    this.appendAudit('sla.register', sla.serviceId, { maxLatencyMs: sla.maxLatencyMs })
  }

  ingest(measurement: QualityMeasurement): void {
    if (!this.slas.has(measurement.serviceId)) {
      throw new Error(`Unknown service: ${measurement.serviceId}`)
    }
    const history = this.measurements.get(measurement.serviceId) ?? []
    history.push(measurement)
    this.measurements.set(measurement.serviceId, history)
  }

  assess(serviceId: string): QualityReport {
    const sla = this.slas.get(serviceId)
    if (!sla) throw new Error(`Unknown service: ${serviceId}`)

    const history = this.measurements.get(serviceId) ?? []
    const breachedSLAs: string[] = []
    const atRiskSLAs: string[] = []
    const recommendations: string[] = []

    if (history.length === 0) {
      this.appendAudit('quality.assess', serviceId, { qualityLevel: 'ACCEPTABLE', reason: '측정값 없음' })
      return {
        serviceId,
        qualityLevel: 'ACCEPTABLE',
        slaStatus: 'WITHIN_SLA',
        qualityScore: 100,
        breachedSLAs: [],
        atRiskSLAs: [],
        recommendations: ['측정값 수집 에이전트 상태 확인 필요'],
      }
    }

    // history.length > 0 guaranteed by early return above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const latest = history[history.length - 1]!
    let score = 100

    // 레이턴시 검사
    if (latest.latencyMs > sla.maxLatencyMs) {
      breachedSLAs.push(`레이턴시 ${latest.latencyMs}ms > SLA ${sla.maxLatencyMs}ms`)
      score -= 30
      recommendations.push('레이턴시 초과 — 캐시 적용 또는 DB 쿼리 최적화 검토')
    } else if (latest.latencyMs > sla.maxLatencyMs * 0.8) {
      atRiskSLAs.push(`레이턴시 ${latest.latencyMs}ms가 SLA 80% 근접`)
      score -= 10
    }

    // 성공률 검사
    if (latest.successRate < sla.minSuccessRate) {
      breachedSLAs.push(`성공률 ${(latest.successRate * 100).toFixed(1)}% < SLA ${(sla.minSuccessRate * 100).toFixed(1)}%`)
      score -= 30
      recommendations.push('성공률 저하 — 에러 로그 분석 및 서킷 브레이커 적용 검토')
    } else if (latest.successRate < sla.minSuccessRate + 0.005) {
      atRiskSLAs.push(`성공률 ${(latest.successRate * 100).toFixed(1)}%가 SLA 근접`)
      score -= 10
    }

    // 에러율 검사
    if (latest.errorRate > sla.maxErrorRate) {
      breachedSLAs.push(`에러율 ${(latest.errorRate * 100).toFixed(1)}% > SLA ${(sla.maxErrorRate * 100).toFixed(1)}%`)
      score -= 20
    }

    score = Math.max(0, score)

    const qualityLevel: QualityLevel =
      score >= 90 ? 'EXCELLENT'
        : score >= 75 ? 'GOOD'
        : score >= 60 ? 'ACCEPTABLE'
        : score >= 40 ? 'POOR'
        : 'UNACCEPTABLE'

    const slaStatus: SLAStatus =
      breachedSLAs.length > 0 ? 'SLA_BREACH'
        : atRiskSLAs.length > 0 ? 'AT_RISK'
        : 'WITHIN_SLA'

    this.appendAudit('quality.assess', serviceId, { qualityLevel, slaStatus, score })

    return { serviceId, qualityLevel, slaStatus, qualityScore: score, breachedSLAs, atRiskSLAs, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
