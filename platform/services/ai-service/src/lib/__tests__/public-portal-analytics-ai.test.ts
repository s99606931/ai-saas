// Plan SC: SVC-AI-ADV-R431-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicPortalAnalyticsAI, type PageVisit } from '../public-portal-analytics-ai'

describe('PublicPortalAnalyticsAI', () => {
  let analytics: PublicPortalAnalyticsAI

  beforeEach(() => {
    analytics = new PublicPortalAnalyticsAI()
  })

  const baseVisit: PageVisit = {
    visitId: 'V1',
    pageUrl: '/main',
    category: 'MAIN',
    deviceType: 'DESKTOP',
    durationSeconds: 60,
    bounced: false,
    timestamp: Date.now(),
    grade: 'O',
  }

  it('N2SF: C등급 방문 데이터 수집 차단', () => {
    expect(() => analytics.ingest({ ...baseVisit, visitId: 'V-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 방문 데이터 수집 차단', () => {
    expect(() => analytics.ingest({ ...baseVisit, visitId: 'V-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('데이터 없을 때 빈 결과 반환', () => {
    const report = analytics.analyze()
    expect(report.totalVisits).toBe(0)
    expect(report.topCategories).toHaveLength(0)
    expect(report.insights).toHaveLength(0)
  })

  it('방문 집계 정확성', () => {
    analytics.ingest(baseVisit)
    analytics.ingest({ ...baseVisit, visitId: 'V2', deviceType: 'MOBILE' })
    const report = analytics.analyze()
    expect(report.totalVisits).toBe(2)
    expect(report.deviceBreakdown.DESKTOP).toBe(1)
    expect(report.deviceBreakdown.MOBILE).toBe(1)
  })

  it('이탈률 계산: 2건 중 1건 이탈 = 50%', () => {
    analytics.ingest(baseVisit)
    analytics.ingest({ ...baseVisit, visitId: 'V2', bounced: true })
    const report = analytics.analyze()
    expect(report.bounceRate).toBe(0.5)
  })

  it('카테고리별 집계 정확성', () => {
    analytics.ingest({ ...baseVisit, visitId: 'V1', category: 'SERVICE' })
    analytics.ingest({ ...baseVisit, visitId: 'V2', category: 'SERVICE' })
    analytics.ingest({ ...baseVisit, visitId: 'V3', category: 'NOTICE' })
    const report = analytics.analyze()
    const serviceCategory = report.topCategories.find((c) => c.category === 'SERVICE')
    expect(serviceCategory?.visitCount).toBe(2)
  })

  it('높은 이탈률 → 인사이트 생성', () => {
    for (let i = 0; i < 7; i++) {
      analytics.ingest({ ...baseVisit, visitId: `BNC-${i}`, bounced: true })
    }
    for (let i = 0; i < 3; i++) {
      analytics.ingest({ ...baseVisit, visitId: `NBN-${i}`, bounced: false })
    }
    const report = analytics.analyze()
    const bounceInsight = report.insights.find((s) => s.includes('이탈률'))
    expect(bounceInsight).toBeDefined()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analytics.ingest(baseVisit)
    analytics.analyze()
    const log1 = analytics.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', detail: {} })
    const log2 = analytics.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
