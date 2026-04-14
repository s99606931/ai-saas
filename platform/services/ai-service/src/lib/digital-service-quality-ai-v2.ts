// Design Ref: §R526 — AI기반 공공기관 디지털 서비스 품질 v2
// Plan SC: SVC-AI-ADV-R526-SC01

export type QualityDimension = 'USABILITY' | 'ACCESSIBILITY' | 'PERFORMANCE' | 'SECURITY' | 'RELIABILITY'
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface ServiceQualityMetrics {
  serviceId: string
  name: string
  usabilityScore: number       // 0..100 (사용자 조사 기반)
  accessibilityScore: number   // 0..100 (WCAG 준수 점수)
  performanceScore: number     // 0..100 (Lighthouse 기반)
  securityScore: number        // 0..100 (보안 취약점 없을수록 높음)
  reliabilityScore: number     // 0..100 (가용성/오류율 기반)
  userComplaintCount: number
  avgResponseTimeMs: number
}

export interface QualityIssue {
  issueId: string
  serviceId: string
  dimension: QualityDimension
  score: number
  detail: string
  improvement: string
}

export interface ServiceQualityReport {
  serviceId: string
  name: string
  overallScore: number
  qualityGrade: QualityGrade
  dimensionScores: Record<QualityDimension, number>
  issues: QualityIssue[]
  recommendations: string[]
  benchmarkComparison: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE'
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  USABILITY: 0.25,
  ACCESSIBILITY: 0.2,
  PERFORMANCE: 0.2,
  SECURITY: 0.2,
  RELIABILITY: 0.15,
}

export class DigitalServiceQualityAIV2 {
  private metrics = new Map<string, ServiceQualityMetrics>()
  private auditLog: AuditEntry[] = []

  registerMetrics(metrics: ServiceQualityMetrics): void {
    this.metrics.set(metrics.serviceId, metrics)
    this.appendAudit('metrics.register', metrics.serviceId, { name: metrics.name })
  }

  evaluate(serviceId: string): ServiceQualityReport {
    const m = this.metrics.get(serviceId)
    if (!m) throw new Error(`Unknown service: ${serviceId}`)

    this.appendAudit('quality.evaluate', serviceId, { name: m.name })

    const issues: QualityIssue[] = []
    const recommendations: string[] = []

    const dimensionScores: Record<QualityDimension, number> = {
      USABILITY: m.usabilityScore,
      ACCESSIBILITY: m.accessibilityScore,
      PERFORMANCE: m.performanceScore,
      SECURITY: m.securityScore,
      RELIABILITY: m.reliabilityScore,
    }

    for (const [dim, score] of Object.entries(dimensionScores) as [QualityDimension, number][]) {
      if (score < 60) {
        issues.push({
          issueId: `ISS-${serviceId}-${dim}`,
          serviceId,
          dimension: dim,
          score,
          detail: `${dim} 점수 ${score}점 — 공공기관 최소 기준(60점) 미달`,
          improvement: this.getImprovement(dim),
        })
        recommendations.push(`${dim} 개선 필요 — ${this.getImprovement(dim)}`)
      }
    }

    if (m.userComplaintCount > 50) {
      recommendations.push(`민원 ${m.userComplaintCount}건 — 사용자 불편 사항 집중 개선`)
    }

    const overallScore = Math.round(
      Object.entries(dimensionScores).reduce((sum, [dim, score]) => {
        return sum + score * (DIMENSION_WEIGHTS[dim as QualityDimension] ?? 0)
      }, 0),
    )

    const qualityGrade: QualityGrade =
      overallScore >= 90 ? 'A'
        : overallScore >= 75 ? 'B'
        : overallScore >= 60 ? 'C'
        : overallScore >= 40 ? 'D'
        : 'F'

    const benchmarkComparison =
      overallScore >= 75 ? 'ABOVE_AVERAGE'
        : overallScore >= 55 ? 'AVERAGE'
        : 'BELOW_AVERAGE'

    return { serviceId, name: m.name, overallScore, qualityGrade, dimensionScores, issues, recommendations, benchmarkComparison }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private getImprovement(dim: QualityDimension): string {
    const map: Record<QualityDimension, string> = {
      USABILITY: 'UX 개선 및 사용자 테스트 실시',
      ACCESSIBILITY: 'WCAG 2.1 AA 기준 준수 및 보조기술 호환성 확보',
      PERFORMANCE: '페이지 로딩 최적화 (Lighthouse 80점 이상 목표)',
      SECURITY: '취약점 스캔 및 보안 패치 즉시 적용',
      RELIABILITY: '이중화 구성 및 자동 복구 메커니즘 도입',
    }
    return map[dim]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
