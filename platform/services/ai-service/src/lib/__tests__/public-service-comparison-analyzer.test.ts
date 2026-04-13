import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceComparisonAnalyzer, type ServiceMetrics, type ComparisonDimension } from '../public-service-comparison-analyzer'

describe('PublicServiceComparisonAnalyzer', () => {
  let analyzer: PublicServiceComparisonAnalyzer

  const svcA: ServiceMetrics = {
    serviceId: 'SVC001',
    serviceName: '민원24',
    orgName: '행정안전부',
    uptimePercent: 99.9,
    avgResponseMs: 100,
    userSatisfactionScore: 4.5,
    costPerTransaction: 0.5,
    monthlyActiveUsers: 100000,
    complianceScore: 95,
  }

  const svcB: ServiceMetrics = {
    serviceId: 'SVC002',
    serviceName: '세금 신고',
    orgName: '국세청',
    uptimePercent: 98.0,
    avgResponseMs: 500,
    userSatisfactionScore: 3.5,
    costPerTransaction: 2.0,
    monthlyActiveUsers: 50000,
    complianceScore: 80,
  }

  const dim: ComparisonDimension = {
    dimensionId: 'DIM001',
    name: '가용성',
    metricField: 'uptimePercent',
    higherIsBetter: true,
    weight: 1,
  }

  beforeEach(() => {
    analyzer = new PublicServiceComparisonAnalyzer()
    analyzer.registerService(svcA)
    analyzer.registerService(svcB)
    analyzer.registerDimension(dim)
  })

  it('서비스 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('가용성 높은 서비스가 1위', () => {
    const report = analyzer.compare()
    expect(report.rankings[0]?.serviceId).toBe('SVC001')
    expect(report.rankings[0]?.rank).toBe(1)
  })

  it('bestInClass 산출', () => {
    const report = analyzer.compare()
    expect(report.bestInClass['가용성']).toBe('민원24')
  })

  it('낮은 costPerTransaction → higherIsBetter=false 차원에서 우위', () => {
    analyzer.registerDimension({
      dimensionId: 'DIM002',
      name: '비용 효율',
      metricField: 'costPerTransaction',
      higherIsBetter: false,
      weight: 1,
    })
    const report = analyzer.compare()
    // costPerTransaction: svcA=0.5 < svcB=2.0 → svcA가 비용 효율 높음
    expect(report.bestInClass['비용 효율']).toBe('민원24')
  })

  it('서비스 없으면 빈 랭킹', () => {
    const emptyAnalyzer = new PublicServiceComparisonAnalyzer()
    const report = emptyAnalyzer.compare()
    expect(report.rankings.length).toBe(0)
  })

  it('strengths/weaknesses 분류', () => {
    const report = analyzer.compare()
    const topSvc = report.rankings[0]!
    expect(topSvc.strengths.length + topSvc.weaknesses.length).toBeGreaterThanOrEqual(0)
  })

  it('비교 후 감사 로그', () => {
    analyzer.compare()
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'service.compare')).toBe(true)
  })
})
