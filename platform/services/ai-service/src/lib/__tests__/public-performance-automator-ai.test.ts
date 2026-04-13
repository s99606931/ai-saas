import { describe, it, expect, beforeEach } from 'vitest'
import { PublicPerformanceAutomatorAi, type PerformanceIndicator } from '../public-performance-automator-ai'

describe('PublicPerformanceAutomatorAi', () => {
  let automator: PublicPerformanceAutomatorAi

  const indicator1: PerformanceIndicator = { indicatorId: 'IND1', name: '민원처리율', targetValue: 95, weight: 50, higherIsBetter: true }
  const indicator2: PerformanceIndicator = { indicatorId: 'IND2', name: '처리시간(일)', targetValue: 3, weight: 50, higherIsBetter: false }

  beforeEach(() => {
    automator = new PublicPerformanceAutomatorAi()
    automator.registerIndicator(indicator1)
    automator.registerIndicator(indicator2)
  })

  it('지표 등록 감사 로그', () => {
    const log = automator.getAuditLog()
    expect(log.some((e) => e.action === 'indicator.register')).toBe(true)
  })

  it('목표 달성 → EXCELLENT/GOOD 등급', () => {
    automator.recordMeasurement({ orgId: 'ORG1', indicatorId: 'IND1', period: '2026-Q1', actualValue: 97 })
    automator.recordMeasurement({ orgId: 'ORG1', indicatorId: 'IND2', period: '2026-Q1', actualValue: 2 })
    const report = automator.evaluate('ORG1', '2026-Q1')
    expect(['EXCELLENT', 'GOOD']).toContain(report.grade)
  })

  it('목표 미달 → POOR/FAIL + 권고사항', () => {
    automator.recordMeasurement({ orgId: 'ORG2', indicatorId: 'IND1', period: '2026-Q1', actualValue: 30 })
    automator.recordMeasurement({ orgId: 'ORG2', indicatorId: 'IND2', period: '2026-Q1', actualValue: 30 })
    const report = automator.evaluate('ORG2', '2026-Q1')
    expect(['POOR', 'FAIL']).toContain(report.grade)
    expect(report.recommendations.length).toBeGreaterThan(0)
  })

  it('compositeScore 0~100 범위', () => {
    const report = automator.evaluate('ORG3', '2026-Q1')
    expect(report.compositeScore).toBeGreaterThanOrEqual(0)
    expect(report.compositeScore).toBeLessThanOrEqual(100)
  })

  it('higherIsBetter=false: 목표보다 낮으면 달성', () => {
    automator.recordMeasurement({ orgId: 'ORG4', indicatorId: 'IND2', period: '2026-Q1', actualValue: 1 })
    const report = automator.evaluate('ORG4', '2026-Q1')
    const ind2Result = report.indicatorResults.find((r) => r.indicatorId === 'IND2')!
    expect(ind2Result.achievementRate).toBeGreaterThan(1)
  })

  it('성과 평가 후 감사 로그', () => {
    automator.evaluate('ORG5', '2026-Q1')
    const log = automator.getAuditLog()
    expect(log.some((e) => e.action === 'performance.evaluate')).toBe(true)
  })
})
