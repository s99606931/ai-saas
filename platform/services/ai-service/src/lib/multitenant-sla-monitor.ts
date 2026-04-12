/**
 * AI 기반 멀티테넌트 SLA 모니터링 — SVC-AI-ADV-R187
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R187/SVC-AI-ADV-R187.design.md
 * Plan SC: FR-R187.1 ~ FR-R187.5
 *
 * 테넌트별 SLA 기준 관리 + 메트릭 기록 + 위반 탐지 + 리포트.
 * CSAP D-08, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface TenantSLA {
  tenantId: string
  tenantName: string
  maxResponseTimeMs: number
  minAvailabilityPercent: number
}

export interface TenantMetric {
  tenantId: string
  requestId: string
  responseTimeMs: number
  success: boolean
  timestamp: number
}

export interface SLAViolation {
  tenantId: string
  type: 'response_time' | 'availability'
  threshold: number
  actual: number
  detectedAt: number
}

export interface TenantSLAReport {
  tenantId: string
  tenantName: string
  totalRequests: number
  avgResponseTimeMs: number
  availabilityPercent: number
  violations: SLAViolation[]
  slaMetStatus: boolean
  reportedAt: number
}

export interface SLAMAuditEntry {
  action: 'tenantRegistered' | 'metricRecorded' | 'violationDetected' | 'reported'
  timestamp: number
  details: Record<string, unknown>
}

export class MultitenantSLAMonitor {
  private readonly tenants = new Map<string, TenantSLA>()
  private readonly metrics = new Map<string, TenantMetric[]>()
  private readonly auditLog: SLAMAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 멀티테넌트 SLA 모니터링 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R187.1 */
  registerTenant(sla: TenantSLA): void {
    if (!sla.tenantId.trim()) throw new Error('tenantId must not be empty')
    if (sla.maxResponseTimeMs <= 0) throw new Error('maxResponseTimeMs must be > 0')
    if (sla.minAvailabilityPercent < 0 || sla.minAvailabilityPercent > 100) {
      throw new Error('minAvailabilityPercent must be 0~100')
    }
    this.tenants.set(sla.tenantId, { ...sla })
    this.audit('tenantRegistered', { tenantId: sla.tenantId, maxRt: sla.maxResponseTimeMs })
  }

  /** FR-R187.2 */
  recordMetric(metric: TenantMetric): void {
    if (!this.tenants.has(metric.tenantId)) {
      throw new Error(`unknown tenant: ${metric.tenantId}`)
    }
    const arr = this.metrics.get(metric.tenantId) ?? []
    arr.push({ ...metric })
    this.metrics.set(metric.tenantId, arr)
    this.audit('metricRecorded', { tenantId: metric.tenantId, responseTimeMs: metric.responseTimeMs })
  }

  /** FR-R187.3 */
  checkViolations(tenantId: string): SLAViolation[] {
    const sla = this.tenants.get(tenantId)
    if (!sla) throw new Error(`unknown tenant: ${tenantId}`)

    const tenantMetrics = this.metrics.get(tenantId) ?? []
    const violations: SLAViolation[] = []

    // Response time violations
    for (const m of tenantMetrics) {
      if (m.responseTimeMs > sla.maxResponseTimeMs) {
        violations.push({
          tenantId,
          type: 'response_time',
          threshold: sla.maxResponseTimeMs,
          actual: m.responseTimeMs,
          detectedAt: m.timestamp,
        })
      }
    }

    // Availability violation (aggregate)
    if (tenantMetrics.length > 0) {
      const successCount = tenantMetrics.filter((m) => m.success).length
      const availability = (successCount / tenantMetrics.length) * 100
      if (availability < sla.minAvailabilityPercent) {
        violations.push({
          tenantId,
          type: 'availability',
          threshold: sla.minAvailabilityPercent,
          actual: availability,
          detectedAt: Date.now(),
        })
      }
    }

    if (violations.length > 0) {
      this.audit('violationDetected', { tenantId, violations: violations.length })
    }

    return violations
  }

  /** FR-R187.4 */
  getReport(tenantId: string): TenantSLAReport {
    const sla = this.tenants.get(tenantId)
    if (!sla) throw new Error(`unknown tenant: ${tenantId}`)

    const tenantMetrics = this.metrics.get(tenantId) ?? []
    const violations = this.checkViolations(tenantId)

    const totalRequests = tenantMetrics.length
    const avgResponseTimeMs = totalRequests > 0
      ? tenantMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / totalRequests
      : 0

    const successCount = tenantMetrics.filter((m) => m.success).length
    const availabilityPercent = totalRequests > 0
      ? (successCount / totalRequests) * 100
      : 100

    const slaMetStatus =
      avgResponseTimeMs <= sla.maxResponseTimeMs &&
      availabilityPercent >= sla.minAvailabilityPercent

    const report: TenantSLAReport = {
      tenantId,
      tenantName: sla.tenantName,
      totalRequests,
      avgResponseTimeMs,
      availabilityPercent,
      violations,
      slaMetStatus,
      reportedAt: Date.now(),
    }

    this.audit('reported', { tenantId, slaMetStatus, violations: violations.length })
    return report
  }

  /** FR-R187.5 */
  getAuditLog(): readonly SLAMAuditEntry[] {
    return [...this.auditLog]
  }

  private audit(action: SLAMAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
