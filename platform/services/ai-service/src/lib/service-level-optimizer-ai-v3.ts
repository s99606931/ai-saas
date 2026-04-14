/**
 * Service Level Optimizer AI V3 — SVC-AI-ADV-R660 (트랙 A 24차)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R660.design.md
 * Plan SC: FR-R660.1 ~ FR-R660.6
 *
 * SLO 위반 예측 + 자원 권고 (SCALE_UP/DOWN/STABLE).
 * N2SF N-05: C/S 등급 차단.
 */

export type DataGrade = 'C' | 'S' | 'O'
export type Recommendation = 'SCALE_UP' | 'SCALE_DOWN' | 'STABLE'

export interface ServiceConfig {
  serviceId: string
  sloTarget: number // 가용성 목표 0~1
  grade: DataGrade
}

export interface Metric {
  serviceId: string
  latencyMs: number
  errorRate: number
  timestamp: string
}

export interface SLOReport {
  serviceId: string
  sloTarget: number
  averageAvailability: number
  averageLatencyMs: number
  violationRate: number
  recommendation: Recommendation
}

export interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const LOW_LATENCY_MS = 100

export class ServiceLevelOptimizerAIV3 {
  private readonly services = new Map<string, ServiceConfig>()
  private readonly metrics = new Map<string, Metric[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R660.1
  registerService(serviceId: string, sloTarget: number, grade: DataGrade = 'O'): ServiceConfig {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (sloTarget < 0 || sloTarget > 1) {
      throw new Error('sloTarget must be 0~1')
    }
    if (this.services.has(serviceId)) {
      throw new Error(`Service already registered: ${serviceId}`)
    }
    const config: ServiceConfig = { serviceId, sloTarget, grade }
    this.services.set(serviceId, config)
    this.metrics.set(serviceId, [])
    this.appendAudit('service.register', serviceId, { sloTarget })
    return { ...config }
  }

  // Plan SC: FR-R660.2
  recordMetric(serviceId: string, latencyMs: number, errorRate: number): Metric {
    this.requireService(serviceId)
    const metric: Metric = {
      serviceId,
      latencyMs,
      errorRate: Math.max(0, Math.min(1, errorRate)),
      timestamp: new Date().toISOString(),
    }
    this.metrics.get(serviceId)!.push(metric)
    return { ...metric }
  }

  // Plan SC: FR-R660.3 + FR-R660.4 + FR-R660.5
  evaluate(serviceId: string): SLOReport {
    const config = this.requireService(serviceId)
    const metrics = this.metrics.get(serviceId)!
    if (metrics.length === 0) {
      return {
        serviceId,
        sloTarget: config.sloTarget,
        averageAvailability: 1,
        averageLatencyMs: 0,
        violationRate: 0,
        recommendation: 'STABLE',
      }
    }
    let totalAvailability = 0
    let totalLatency = 0
    let violations = 0
    for (const m of metrics) {
      const availability = 1 - m.errorRate
      totalAvailability += availability
      totalLatency += m.latencyMs
      if (availability < config.sloTarget) violations += 1
    }
    const averageAvailability = totalAvailability / metrics.length
    const averageLatencyMs = totalLatency / metrics.length
    const violationRate = violations / metrics.length
    let recommendation: Recommendation = 'STABLE'
    if (violationRate >= 0.3) recommendation = 'SCALE_UP'
    else if (violationRate <= 0.05 && averageLatencyMs < LOW_LATENCY_MS) recommendation = 'SCALE_DOWN'
    this.appendAudit('evaluate', serviceId, { violationRate, recommendation })
    return {
      serviceId,
      sloTarget: config.sloTarget,
      averageAvailability,
      averageLatencyMs,
      violationRate,
      recommendation,
    }
  }

  // Plan SC: FR-R660.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireService(serviceId: string): ServiceConfig {
    const c = this.services.get(serviceId)
    if (!c) throw new Error(`Unknown service: ${serviceId}`)
    return c
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
