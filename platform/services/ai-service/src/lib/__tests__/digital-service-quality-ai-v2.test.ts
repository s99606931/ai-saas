// Plan SC: SVC-AI-ADV-R526-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalServiceQualityAIV2, type ServiceQualityMetrics } from '../digital-service-quality-ai-v2'

describe('DigitalServiceQualityAIV2', () => {
  let quality: DigitalServiceQualityAIV2

  const goodMetrics: ServiceQualityMetrics = {
    serviceId: 'SVC-1',
    name: '민원 포털',
    usabilityScore: 85,
    accessibilityScore: 80,
    performanceScore: 78,
    securityScore: 90,
    reliabilityScore: 88,
    userComplaintCount: 10,
    avgResponseTimeMs: 300,
  }

  beforeEach(() => {
    quality = new DigitalServiceQualityAIV2()
  })

  it('미등록 서비스 평가 시 오류 발생', () => {
    expect(() => quality.evaluate('UNKNOWN')).toThrow('Unknown service')
  })

  it('우수 서비스 → grade A 또는 B, ABOVE_AVERAGE', () => {
    quality.registerMetrics(goodMetrics)
    const report = quality.evaluate('SVC-1')
    expect(['A', 'B']).toContain(report.qualityGrade)
    expect(report.benchmarkComparison).toBe('ABOVE_AVERAGE')
  })

  it('점수 60 미만 차원 → issues 생성', () => {
    quality.registerMetrics({ ...goodMetrics, serviceId: 'SVC-LOW', usabilityScore: 45, accessibilityScore: 50 })
    const report = quality.evaluate('SVC-LOW')
    expect(report.issues.some((i) => i.dimension === 'USABILITY' && i.score === 45)).toBe(true)
    expect(report.issues.some((i) => i.dimension === 'ACCESSIBILITY')).toBe(true)
  })

  it('overallScore 가중 평균 정확 계산', () => {
    quality.registerMetrics(goodMetrics)
    const report = quality.evaluate('SVC-1')
    const expected = Math.round(
      85 * 0.25 + 80 * 0.2 + 78 * 0.2 + 90 * 0.2 + 88 * 0.15,
    )
    expect(report.overallScore).toBe(expected)
  })

  it('전체 점수 60 미만 → grade D 또는 F, BELOW_AVERAGE', () => {
    quality.registerMetrics({
      ...goodMetrics, serviceId: 'SVC-POOR',
      usabilityScore: 40, accessibilityScore: 35, performanceScore: 30,
      securityScore: 50, reliabilityScore: 45,
    })
    const report = quality.evaluate('SVC-POOR')
    expect(['D', 'F']).toContain(report.qualityGrade)
    expect(report.benchmarkComparison).toBe('BELOW_AVERAGE')
  })

  it('민원 50건 초과 → 민원 개선 권고 포함', () => {
    quality.registerMetrics({ ...goodMetrics, serviceId: 'SVC-COMP', userComplaintCount: 80 })
    const report = quality.evaluate('SVC-COMP')
    expect(report.recommendations.some((r) => r.includes('민원'))).toBe(true)
  })

  it('dimensionScores 모든 차원 반환', () => {
    quality.registerMetrics(goodMetrics)
    const report = quality.evaluate('SVC-1')
    expect(Object.keys(report.dimensionScores)).toHaveLength(5)
    expect(report.dimensionScores.USABILITY).toBe(85)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    quality.registerMetrics(goodMetrics)
    quality.evaluate('SVC-1')
    const log1 = quality.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = quality.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
