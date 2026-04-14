// Design Ref: §R583 — AI기반 서비스 품질 자동 측정 v3
// Plan SC: SVC-AI-ADV-R583-SC01

export type QualityDimension = 'PERFORMANCE' | 'RELIABILITY' | 'SECURITY' | 'USABILITY' | 'MAINTAINABILITY'
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface QualityMetric {
  serviceId: string
  period: string       // 'YYYY-MM'
  performanceScore: number    // 0..100
  reliabilityScore: number
  securityScore: number
  usabilityScore: number
  maintainabilityScore: number
}

export interface QualityMeasurement {
  serviceId: string
  period: string
  overallScore: number
  grade: QualityGrade
  dimensionScores: Record<QualityDimension, number>
  issues: string[]
  recommendations: string[]
}

export interface QualityTrendPoint {
  period: string
  overallScore: number
  grade: QualityGrade
}

export interface QualityReport {
  totalServices: number
  avgOverallScore: number
  gradeDistribution: Record<QualityGrade, number>
  measurements: QualityMeasurement[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const WEIGHTS: Record<QualityDimension, number> = {
  PERFORMANCE: 0.25,
  RELIABILITY: 0.25,
  SECURITY: 0.20,
  USABILITY: 0.15,
  MAINTAINABILITY: 0.15,
}

export class ServiceQualityAutoMeasurerV3 {
  private metrics = new Map<string, QualityMetric[]>()   // serviceId → metrics[]
  private auditLog: AuditEntry[] = []

  registerMetric(metric: QualityMetric): void {
    const list = this.metrics.get(metric.serviceId) ?? []
    list.push(metric)
    this.metrics.set(metric.serviceId, list)
    this.appendAudit('metric.register', metric.serviceId, { period: metric.period })
  }

  measure(serviceId: string): QualityMeasurement {
    const list = this.metrics.get(serviceId)
    if (!list || list.length === 0) throw new Error(`No metrics for service: ${serviceId}`)

    const latest = list[list.length - 1]
    if (!latest) throw new Error(`No metrics for service: ${serviceId}`)
    const dimensionScores: Record<QualityDimension, number> = {
      PERFORMANCE: latest.performanceScore,
      RELIABILITY: latest.reliabilityScore,
      SECURITY: latest.securityScore,
      USABILITY: latest.usabilityScore,
      MAINTAINABILITY: latest.maintainabilityScore,
    }

    const overallScore = Math.round(
      Object.entries(dimensionScores).reduce((s, [dim, score]) => s + score * (WEIGHTS[dim as QualityDimension] ?? 0), 0),
    )

    const grade: QualityGrade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F'

    const issues: string[] = []
    const recommendations: string[] = []
    for (const [dim, score] of Object.entries(dimensionScores) as [QualityDimension, number][]) {
      if (score < 60) {
        issues.push(`${dim} 점수 ${score}점 — 기준(60점) 미달`)
        recommendations.push(`${dim} 개선 계획 수립 필요`)
      }
    }

    this.appendAudit('quality.measure', serviceId, { overallScore, grade, period: latest.period })
    return { serviceId, period: latest.period, overallScore, grade, dimensionScores, issues, recommendations }
  }

  getTrend(serviceId: string): QualityTrendPoint[] {
    const list = this.metrics.get(serviceId) ?? []
    return list.map((m) => {
      const overallScore = Math.round(
        m.performanceScore * 0.25 + m.reliabilityScore * 0.25 + m.securityScore * 0.20 +
        m.usabilityScore * 0.15 + m.maintainabilityScore * 0.15,
      )
      const grade: QualityGrade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F'
      return { period: m.period, overallScore, grade }
    })
  }

  generateReport(): QualityReport {
    const serviceIds = Array.from(this.metrics.keys())
    const measurements = serviceIds.map((id) => this.measure(id))
    const avgOverallScore = measurements.length > 0
      ? Math.round(measurements.reduce((s, m) => s + m.overallScore, 0) / measurements.length) : 0
    const gradeDistribution: Record<QualityGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    for (const m of measurements) gradeDistribution[m.grade]++
    this.appendAudit('report.generate', 'system', { totalServices: serviceIds.length, avgOverallScore })
    return { totalServices: serviceIds.length, avgOverallScore, gradeDistribution, measurements, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
