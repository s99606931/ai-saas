import { describe, it, expect, beforeEach } from 'vitest'
import { TestCoverageAnalyzerAi, type ModuleProfile, type CoverageReport } from '../test-coverage-analyzer-ai'

describe('TestCoverageAnalyzerAi', () => {
  let analyzer: TestCoverageAnalyzerAi

  const profile: ModuleProfile = {
    moduleId: 'MOD001',
    name: '민원 처리 모듈',
    totalLines: 1000,
    businessCritical: true,
  }

  const makeReport = (covered: number, branch: number, mutation: number): CoverageReport => ({
    moduleId: 'MOD001',
    coveredLines: covered,
    totalLines: 1000,
    branchCoverage: branch,
    mutationScore: mutation,
    measuredAt: new Date().toISOString(),
  })

  beforeEach(() => {
    analyzer = new TestCoverageAnalyzerAi()
    analyzer.registerModule(profile)
  })

  it('모듈 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'module.register')).toBe(true)
  })

  it('측정 없으면 CRITICAL', () => {
    const result = analyzer.analyze('MOD001')
    expect(result.status).toBe('CRITICAL')
    expect(result.riskLevel).toBe('CRITICAL')
  })

  it('높은 커버리지 → EXCELLENT', () => {
    analyzer.recordCoverage(makeReport(950, 0.9, 0.85))
    const result = analyzer.analyze('MOD001')
    expect(result.status).toBe('EXCELLENT')
    expect(result.riskLevel).toBe('LOW')
  })

  it('낮은 커버리지 → CRITICAL + 갭 식별', () => {
    analyzer.recordCoverage(makeReport(500, 0.5, 0.4))
    const result = analyzer.analyze('MOD001')
    expect(result.status).toBe('CRITICAL')
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('중간 커버리지 → INSUFFICIENT HIGH (businessCritical)', () => {
    analyzer.recordCoverage(makeReport(700, 0.65, 0.6))
    const result = analyzer.analyze('MOD001')
    expect(result.status).toBe('INSUFFICIENT')
    expect(result.riskLevel).toBe('HIGH')
  })

  it('coveredLines > totalLines 에러', () => {
    expect(() => analyzer.recordCoverage({ ...makeReport(1100, 0.9, 0.8), coveredLines: 1100 })).toThrow()
  })

  it('미등록 모듈 에러', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    analyzer.recordCoverage(makeReport(800, 0.8, 0.7))
    analyzer.analyze('MOD001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'coverage.analyze')).toBe(true)
  })
})
