// Plan SC: SVC-AI-ADV-R583-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceQualityAutoMeasurerV3, type QualityMetric } from '../service-quality-auto-measurer-v3'

describe('ServiceQualityAutoMeasurerV3', () => {
  let measurer: ServiceQualityAutoMeasurerV3

  const goodMetric: QualityMetric = {
    serviceId: 'SVC-1',
    period: '2026-01',
    performanceScore: 85,
    reliabilityScore: 90,
    securityScore: 88,
    usabilityScore: 80,
    maintainabilityScore: 75,
  }

  beforeEach(() => {
    measurer = new ServiceQualityAutoMeasurerV3()
  })

  it('메트릭 없는 서비스 측정 시 오류 발생', () => {
    expect(() => measurer.measure('UNKNOWN')).toThrow('No metrics for service')
  })

  it('우수 메트릭 → 높은 overallScore, grade A 또는 B', () => {
    measurer.registerMetric(goodMetric)
    const result = measurer.measure('SVC-1')
    expect(result.overallScore).toBeGreaterThan(75)
    expect(['A', 'B']).toContain(result.grade)
  })

  it('점수 60 미만 차원 → issues 생성', () => {
    measurer.registerMetric({ ...goodMetric, serviceId: 'SVC-LOW', securityScore: 50, usabilityScore: 40 })
    const result = measurer.measure('SVC-LOW')
    expect(result.issues.some((i) => i.includes('SECURITY'))).toBe(true)
    expect(result.issues.some((i) => i.includes('USABILITY'))).toBe(true)
  })

  it('overallScore 가중 평균 정확', () => {
    measurer.registerMetric(goodMetric)
    const result = measurer.measure('SVC-1')
    const expected = Math.round(85 * 0.25 + 90 * 0.25 + 88 * 0.20 + 80 * 0.15 + 75 * 0.15)
    expect(result.overallScore).toBe(expected)
  })

  it('getTrend: 기간별 점수 추이 반환', () => {
    measurer.registerMetric(goodMetric)
    measurer.registerMetric({ ...goodMetric, period: '2026-02', performanceScore: 90 })
    const trend = measurer.getTrend('SVC-1')
    expect(trend).toHaveLength(2)
    expect(trend[0]?.period).toBe('2026-01')
  })

  it('generateReport: 전체 서비스 요약', () => {
    measurer.registerMetric(goodMetric)
    measurer.registerMetric({ ...goodMetric, serviceId: 'SVC-2', period: '2026-01', performanceScore: 40, reliabilityScore: 35, securityScore: 30, usabilityScore: 35, maintainabilityScore: 38 })
    const report = measurer.generateReport()
    expect(report.totalServices).toBe(2)
    expect(report.gradeDistribution).toBeDefined()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    measurer.registerMetric(goodMetric)
    measurer.measure('SVC-1')
    const log1 = measurer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = measurer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
