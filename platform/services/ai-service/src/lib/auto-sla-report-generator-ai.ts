// Design Ref: §R396 — AI기반 자동 서비스 수준 보고서
// Plan SC: SVC-AI-ADV-R396-SC01

export type ReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type SLAGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface SLAMetric {
  serviceId: string
  period: ReportPeriod
  availabilityRate: number   // 0..1
  avgResponseTimeMs: number
  p99ResponseTimeMs: number
  errorRate: number          // 0..1
  incidentCount: number
  mttrMin: number            // Mean Time To Recover (minutes)
}

export interface SLAReport {
  serviceId: string
  period: ReportPeriod
  grade: SLAGrade
  overallScore: number  // 0..100
  summary: string
  highlights: string[]
  improvements: string[]
  trendVsPreviousPeriod: 'IMPROVED' | 'STABLE' | 'DEGRADED'
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class AutoSLAReportGeneratorAI {
  private metrics = new Map<string, SLAMetric[]>()
  private auditLog: AuditEntry[] = []

  ingestMetric(metric: SLAMetric): void {
    const key = `${metric.serviceId}:${metric.period}`
    const list = this.metrics.get(key) ?? []
    list.push(metric)
    this.metrics.set(key, list)
    this.appendAudit('metric.ingest', metric.serviceId, { period: metric.period })
  }

  generateReport(serviceId: string, period: ReportPeriod): SLAReport {
    const key = `${serviceId}:${period}`
    const list = this.metrics.get(key) ?? []
    this.appendAudit('report.generate', serviceId, { period, metricCount: list.length })

    if (list.length === 0) {
      return {
        serviceId, period, grade: 'F', overallScore: 0,
        summary: '측정 데이터 없음',
        highlights: [], improvements: ['메트릭 수집 에이전트 배포 확인'],
        trendVsPreviousPeriod: 'STABLE',
      }
    }

    // 최신 메트릭 기준
    const latest = list[list.length - 1] ?? list[0]
    if (!latest) {
      return {
        serviceId, period, grade: 'F', overallScore: 0,
        summary: '측정 데이터 없음',
        highlights: [], improvements: ['메트릭 수집 에이전트 배포 확인'],
        trendVsPreviousPeriod: 'STABLE',
      }
    }
    let score = 100
    const highlights: string[] = []
    const improvements: string[] = []

    // 가용성 평가
    if (latest.availabilityRate >= 0.999) { highlights.push(`가용성 ${(latest.availabilityRate * 100).toFixed(2)}% — SLA 우수`) }
    else if (latest.availabilityRate >= 0.99) { score -= 10 }
    else if (latest.availabilityRate >= 0.95) { score -= 25; improvements.push('가용성 개선 필요 — 이중화 검토') }
    else { score -= 40; improvements.push('가용성 심각 저하 — 긴급 아키텍처 검토 필요') }

    // 응답 시간 평가
    if (latest.avgResponseTimeMs <= 200) { highlights.push(`평균 응답 ${latest.avgResponseTimeMs}ms — 우수`) }
    else if (latest.avgResponseTimeMs <= 500) { score -= 5 }
    else if (latest.avgResponseTimeMs <= 1000) { score -= 15; improvements.push('응답 시간 최적화 필요') }
    else { score -= 30; improvements.push('심각한 레이턴시 — 성능 프로파일링 즉시 실행') }

    // 에러율 평가
    if (latest.errorRate <= 0.001) { highlights.push(`에러율 ${(latest.errorRate * 100).toFixed(2)}% — 매우 안정`) }
    else if (latest.errorRate <= 0.01) { score -= 5 }
    else if (latest.errorRate <= 0.05) { score -= 20; improvements.push('에러율 초과 — 에러 로그 분석 필요') }
    else { score -= 35; improvements.push('에러율 심각 — 서비스 안정성 긴급 점검') }

    // 장애 대응 시간
    if (latest.incidentCount > 0 && latest.mttrMin > 60) {
      score -= 10
      improvements.push(`MTTR ${latest.mttrMin}분 — 장애 대응 프로세스 개선 필요`)
    }

    score = Math.max(0, Math.min(100, score))

    const grade: SLAGrade =
      score >= 95 ? 'A'
        : score >= 85 ? 'B'
        : score >= 70 ? 'C'
        : score >= 55 ? 'D'
        : 'F'

    // 트렌드 (이전 메트릭과 비교)
    let trendVsPreviousPeriod: SLAReport['trendVsPreviousPeriod'] = 'STABLE'
    if (list.length >= 2) {
      const prev = list[list.length - 2] ?? list[0]
      if (prev) {
        const prevScore = prev.availabilityRate * 50 + (1 - prev.errorRate) * 30 + Math.min(1, 500 / prev.avgResponseTimeMs) * 20
        const currScore = latest.availabilityRate * 50 + (1 - latest.errorRate) * 30 + Math.min(1, 500 / latest.avgResponseTimeMs) * 20
        trendVsPreviousPeriod = currScore > prevScore * 1.02 ? 'IMPROVED' : currScore < prevScore * 0.98 ? 'DEGRADED' : 'STABLE'
      }
    }

    const summary = `${serviceId} ${period} SLA 보고서: 종합 점수 ${score}점 (${grade}등급), 가용성 ${(latest.availabilityRate * 100).toFixed(2)}%, 에러율 ${(latest.errorRate * 100).toFixed(2)}%`

    return { serviceId, period, grade, overallScore: score, summary, highlights, improvements, trendVsPreviousPeriod }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
