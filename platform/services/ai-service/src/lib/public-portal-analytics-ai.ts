// Design Ref: §R431 — AI기반 공공 서비스 통합 포털 분석
// Plan SC: SVC-AI-ADV-R431-SC01

export type PageCategory = 'MAIN' | 'SERVICE' | 'NOTICE' | 'FORM' | 'FAQ' | 'CONTACT'
export type DeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET'
export type DataGrade = 'C' | 'S' | 'O'

export interface PageVisit {
  visitId: string
  pageUrl: string
  category: PageCategory
  deviceType: DeviceType
  durationSeconds: number
  bounced: boolean       // 단일 페이지 이탈 여부
  timestamp: number
  grade: DataGrade
}

export interface PortalAnalyticsReport {
  totalVisits: number
  bounceRate: number           // 0..1
  avgDurationSeconds: number
  topCategories: Array<{ category: PageCategory; visitCount: number; avgDuration: number }>
  deviceBreakdown: Record<DeviceType, number>
  insights: string[]
  generatedAt: string
}

export class PublicPortalAnalyticsAI {
  private visits: PageVisit[] = []
  private auditLog: Array<{ timestamp: string; action: string; detail: Record<string, unknown> }> = []

  ingest(visit: PageVisit): void {
    // N2SF C/S 등급 차단
    if (visit.grade === 'C' || visit.grade === 'S') {
      throw new Error(`BLOCKED: ${visit.grade}등급 포털 방문 데이터는 AI 분석 금지 (N2SF N-05)`)
    }
    this.visits.push(visit)
  }

  analyze(): PortalAnalyticsReport {
    this.appendAudit('portal.analyze', { visitCount: this.visits.length })

    const generatedAt = new Date().toISOString()

    if (this.visits.length === 0) {
      return {
        totalVisits: 0, bounceRate: 0, avgDurationSeconds: 0,
        topCategories: [], deviceBreakdown: { DESKTOP: 0, MOBILE: 0, TABLET: 0 },
        insights: [], generatedAt,
      }
    }

    const totalVisits = this.visits.length
    const bouncedCount = this.visits.filter((v) => v.bounced).length
    const bounceRate = bouncedCount / totalVisits
    const avgDurationSeconds = this.visits.reduce((s, v) => s + v.durationSeconds, 0) / totalVisits

    // 카테고리별 집계
    const categoryMap = new Map<PageCategory, { count: number; totalDuration: number }>()
    for (const visit of this.visits) {
      const existing = categoryMap.get(visit.category)
      if (existing) {
        existing.count++
        existing.totalDuration += visit.durationSeconds
      } else {
        categoryMap.set(visit.category, { count: 1, totalDuration: visit.durationSeconds })
      }
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        visitCount: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
      }))
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 3)

    // 디바이스 분포
    const deviceBreakdown: Record<DeviceType, number> = { DESKTOP: 0, MOBILE: 0, TABLET: 0 }
    for (const visit of this.visits) {
      deviceBreakdown[visit.deviceType]++
    }

    // 인사이트 생성
    const insights: string[] = []
    if (bounceRate > 0.6) insights.push(`이탈률 ${(bounceRate * 100).toFixed(0)}% 높음 — 메인 페이지 UX 개선 필요`)
    if (avgDurationSeconds < 30) insights.push('평균 체류 시간 30초 미만 — 콘텐츠 관련성 검토 필요')
    const mobileRatio = deviceBreakdown.MOBILE / totalVisits
    if (mobileRatio > 0.5) insights.push(`모바일 비율 ${(mobileRatio * 100).toFixed(0)}% — 모바일 최적화 우선 적용 권장`)
    if (topCategories[0]) insights.push(`최다 방문 카테고리: ${topCategories[0].category} (${topCategories[0].visitCount}회)`)

    return { totalVisits, bounceRate, avgDurationSeconds, topCategories, deviceBreakdown, insights, generatedAt }
  }

  getAuditLog(): Array<{ timestamp: string; action: string; detail: Record<string, unknown> }> {
    return [...this.auditLog]
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
