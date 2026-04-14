// Design Ref: §R610 — AI기반 공공기관 서비스 신뢰도 측정 v2
// Plan SC: SVC-AI-ADV-R610-SC01

export type TrustGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type TrustDimension = 'AVAILABILITY' | 'SECURITY' | 'TRANSPARENCY' | 'RESPONSIVENESS' | 'COMPLIANCE'

export interface TrustMetrics {
  serviceId: string
  name: string
  availabilityScore: number     // 0..100
  securityScore: number
  transparencyScore: number
  responsivenessScore: number
  complianceScore: number
  incidentCount: number
  userComplaintCount: number
}

export interface TrustMeasurement {
  serviceId: string
  name: string
  trustScore: number
  trustGrade: TrustGrade
  dimensionScores: Record<TrustDimension, number>
  weakDimensions: TrustDimension[]
  recommendations: string[]
}

export interface TrustReport {
  totalServices: number
  avgTrustScore: number
  gradeDistribution: Record<TrustGrade, number>
  measurements: TrustMeasurement[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const WEIGHTS: Record<TrustDimension, number> = {
  AVAILABILITY: 0.25,
  SECURITY: 0.25,
  TRANSPARENCY: 0.20,
  RESPONSIVENESS: 0.15,
  COMPLIANCE: 0.15,
}

export class ServiceTrustworthinessMeasurerV2 {
  private metrics = new Map<string, TrustMetrics>()
  private auditLog: AuditEntry[] = []

  registerMetrics(m: TrustMetrics): void {
    this.metrics.set(m.serviceId, m)
    this.appendAudit('metrics.register', m.serviceId, { name: m.name })
  }

  measure(serviceId: string): TrustMeasurement {
    const m = this.metrics.get(serviceId)
    if (!m) throw new Error(`Unknown service: ${serviceId}`)

    const dimensionScores: Record<TrustDimension, number> = {
      AVAILABILITY: m.availabilityScore,
      SECURITY: m.securityScore,
      TRANSPARENCY: m.transparencyScore,
      RESPONSIVENESS: m.responsivenessScore,
      COMPLIANCE: m.complianceScore,
    }

    const trustScore = Math.round(
      Object.entries(dimensionScores).reduce((s, [dim, score]) => s + score * (WEIGHTS[dim as TrustDimension] ?? 0), 0),
    )

    const trustGrade: TrustGrade = trustScore >= 90 ? 'A' : trustScore >= 75 ? 'B' : trustScore >= 60 ? 'C' : trustScore >= 40 ? 'D' : 'F'

    const weakDimensions = (Object.entries(dimensionScores) as [TrustDimension, number][])
      .filter(([, score]) => score < 60)
      .map(([dim]) => dim)

    const recommendations: string[] = []
    for (const dim of weakDimensions) recommendations.push(`${dim} 신뢰도 개선 필요 — 점수 ${dimensionScores[dim]}점`)
    if (m.incidentCount > 5) recommendations.push(`최근 장애 ${m.incidentCount}건 — 근본 원인 분석 및 재발 방지 조치`)
    if (m.userComplaintCount > 20) recommendations.push(`민원 ${m.userComplaintCount}건 — 서비스 품질 개선 우선 조치`)

    this.appendAudit('trust.measure', serviceId, { trustScore, trustGrade })
    return { serviceId, name: m.name, trustScore, trustGrade, dimensionScores, weakDimensions, recommendations }
  }

  generateReport(): TrustReport {
    const serviceIds = Array.from(this.metrics.keys())
    const measurements = serviceIds.map((id) => this.measure(id))
    const avgTrustScore = measurements.length > 0
      ? Math.round(measurements.reduce((s, m) => s + m.trustScore, 0) / measurements.length) : 0
    const gradeDistribution: Record<TrustGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    for (const m of measurements) gradeDistribution[m.trustGrade]++
    this.appendAudit('report.generate', 'system', { totalServices: serviceIds.length, avgTrustScore })
    return { totalServices: serviceIds.length, avgTrustScore, gradeDistribution, measurements, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
