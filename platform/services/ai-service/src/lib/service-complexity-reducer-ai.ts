// Design Ref: §R419 — AI기반 서비스 복잡도 자동 감소
// Plan SC: SC-R419

export interface ServiceComplexityMetric {
  serviceId: string
  serviceName: string
  dependencyCount: number
  apiCount: number
  linesOfCode: number
  hasCircularDeps: boolean
}

export type ComplexityLevel = 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'OVERLY_COMPLEX'

export interface ComplexityAnalysis {
  serviceId: string
  serviceName: string
  complexityScore: number
  complexityLevel: ComplexityLevel
  splitRecommended: boolean
  actions: string[]
}

export interface ComplexityReport {
  totalServices: number
  overlyComplexCount: number
  averageScore: number
  analyses: ComplexityAnalysis[]
  priorityActions: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceComplexityReducerAi {
  private metrics = new Map<string, ServiceComplexityMetric>()
  private auditLog: AuditEntry[] = []

  registerService(metric: ServiceComplexityMetric): void {
    this.metrics.set(metric.serviceId, metric)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: metric.serviceId })
  }

  analyze(): ComplexityReport {
    const analyses: ComplexityAnalysis[] = []
    const priorityActions: string[] = []

    for (const metric of this.metrics.values()) {
      const complexityScore = metric.dependencyCount * 3 + metric.apiCount * 2 + Math.floor(metric.linesOfCode / 100)
      const circularPenalty = metric.hasCircularDeps ? 15 : 0
      const totalScore = complexityScore + circularPenalty

      const complexityLevel: ComplexityLevel = totalScore >= 35
        ? 'OVERLY_COMPLEX'
        : totalScore >= 20
          ? 'COMPLEX'
          : totalScore >= 10
            ? 'MODERATE'
            : 'SIMPLE'

      const splitRecommended = complexityLevel === 'OVERLY_COMPLEX'
      const actions: string[] = []

      if (splitRecommended) actions.push('서비스 분리 — 단일 책임 원칙 적용 (마이크로서비스 분할)')
      if (metric.dependencyCount >= 10) actions.push(`의존성 ${metric.dependencyCount}개 → 10개 미만으로 감소 (인터페이스 추상화)`)
      if (metric.apiCount > 10) actions.push(`API ${metric.apiCount}개 → 핵심 API만 유지, 나머지 통합`)
      if (metric.hasCircularDeps) actions.push('순환 의존성 제거 — 이벤트 기반 아키텍처 전환')
      if (metric.linesOfCode > 3000) actions.push(`코드 ${metric.linesOfCode}줄 → 모듈 분리로 800줄 이하 목표`)

      analyses.push({ serviceId: metric.serviceId, serviceName: metric.serviceName, complexityScore: totalScore, complexityLevel, splitRecommended, actions })

      if (complexityLevel === 'OVERLY_COMPLEX') {
        priorityActions.push(`우선 처리: ${metric.serviceName} (복잡도 ${totalScore}) — 서비스 분리`)
      }
    }

    const overlyComplexCount = analyses.filter((a) => a.complexityLevel === 'OVERLY_COMPLEX').length
    const averageScore = analyses.length > 0
      ? Math.round(analyses.reduce((s, a) => s + a.complexityScore, 0) / analyses.length)
      : 0

    this.auditLog.push({ action: 'complexity.analyze', timestamp: new Date().toISOString(), detail: `overly=${overlyComplexCount}` })
    return { totalServices: this.metrics.size, overlyComplexCount, averageScore, analyses, priorityActions }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
