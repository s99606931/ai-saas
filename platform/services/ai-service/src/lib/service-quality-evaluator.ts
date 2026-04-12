/**
 * Service Quality Evaluator — SVC-AI-ADV-R166 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R166/SVC-AI-ADV-R166.design.md
 * Plan SC: FR-R166.1 ~ FR-R166.5
 *
 * SLA 기준 등록 → 메트릭 수집 → 품질 등급 산정 (A/B/C/D/F).
 * CSAP D-06: 감사 로그. 외부 API 없음.
 */

// Design Ref: §타입 정의

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ServiceMetric {
  serviceId: string
  timestamp: number
  responseTimeMs: number
  errorRate: number
  availabilityPct: number
}

export interface SlaThreshold {
  serviceId: string
  maxResponseTimeMs: number
  maxErrorRate: number
  minAvailabilityPct: number
}

export interface QualityReport {
  serviceId: string
  grade: QualityGrade
  score: number
  avgResponseTimeMs: number
  avgErrorRate: number
  avgAvailabilityPct: number
  slaViolations: string[]
  evaluatedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceQualityEvaluator {
  private readonly slas = new Map<string, SlaThreshold>()
  private readonly metrics = new Map<string, ServiceMetric[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R166.2
  registerSla(threshold: SlaThreshold): void {
    this.slas.set(threshold.serviceId, { ...threshold })
    this.appendAudit('sla.register', threshold.serviceId, { threshold })
  }

  // Plan SC: FR-R166.1
  recordMetric(metric: ServiceMetric): void {
    if (!this.metrics.has(metric.serviceId)) {
      this.metrics.set(metric.serviceId, [])
    }
    this.metrics.get(metric.serviceId)!.push({ ...metric })
  }

  // Plan SC: FR-R166.3 — Design Ref: §알고리즘 점수 계산
  evaluate(serviceId: string): QualityReport {
    const sla = this.slas.get(serviceId)
    const records = this.metrics.get(serviceId) ?? []
    if (records.length === 0) {
      const empty: QualityReport = {
        serviceId, grade: 'F', score: 0,
        avgResponseTimeMs: 0, avgErrorRate: 0, avgAvailabilityPct: 0,
        slaViolations: ['메트릭 데이터 없음'], evaluatedAt: new Date().toISOString(),
      }
      return empty
    }

    const avgResponseTimeMs = records.reduce((s, r) => s + r.responseTimeMs, 0) / records.length
    const avgErrorRate = records.reduce((s, r) => s + r.errorRate, 0) / records.length
    const avgAvailabilityPct = records.reduce((s, r) => s + r.availabilityPct, 0) / records.length

    let score = 100
    const slaViolations: string[] = []

    if (sla) {
      // 응답시간 40점
      if (avgResponseTimeMs <= sla.maxResponseTimeMs) {
        score -= 0
      } else {
        const ratio = Math.min(avgResponseTimeMs / sla.maxResponseTimeMs, 2)
        score -= Math.round(40 * Math.min((ratio - 1), 1))
        slaViolations.push(`응답시간 초과: ${Math.round(avgResponseTimeMs)}ms > ${sla.maxResponseTimeMs}ms`)
      }

      // 오류율 30점
      if (avgErrorRate > sla.maxErrorRate) {
        score -= 30
        slaViolations.push(`오류율 초과: ${(avgErrorRate * 100).toFixed(1)}% > ${(sla.maxErrorRate * 100).toFixed(1)}%`)
      }

      // 가용성 30점
      if (avgAvailabilityPct >= sla.minAvailabilityPct) {
        score -= 0
      } else {
        const ratio = avgAvailabilityPct / sla.minAvailabilityPct
        score -= Math.round(30 * (1 - ratio))
        slaViolations.push(`가용성 미달: ${avgAvailabilityPct.toFixed(2)}% < ${sla.minAvailabilityPct}%`)
      }
    }

    score = Math.max(0, Math.min(100, score))
    const grade = this.calcGrade(score)

    const report: QualityReport = {
      serviceId, grade, score: Math.round(score),
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      avgErrorRate: Math.round(avgErrorRate * 10000) / 10000,
      avgAvailabilityPct: Math.round(avgAvailabilityPct * 100) / 100,
      slaViolations,
      evaluatedAt: new Date().toISOString(),
    }
    this.appendAudit('quality.evaluate', serviceId, { grade, score: report.score })
    return report
  }

  // Plan SC: FR-R166.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private calcGrade(score: number): QualityGrade {
    if (score >= 90) return 'A'
    if (score >= 75) return 'B'
    if (score >= 60) return 'C'
    if (score >= 40) return 'D'
    return 'F'
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
