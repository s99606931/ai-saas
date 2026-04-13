import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataUtilizationAnalyzer, type PublicDataset } from '../public-data-utilization-analyzer'

describe('PublicDataUtilizationAnalyzer', () => {
  let analyzer: PublicDataUtilizationAnalyzer

  const dataset: PublicDataset = {
    datasetId: 'DS001',
    name: '민원 현황 데이터',
    category: 'civil-affairs',
    dataGrade: 'O',
    totalRecords: 10000,
    lastUpdatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    analyzer = new PublicDataUtilizationAnalyzer()
    analyzer.registerDataset(dataset)
  })

  it('C/S 등급 데이터셋 차단', () => {
    expect(() => analyzer.registerDataset({ ...dataset, datasetId: 'DS_C', dataGrade: 'C' })).toThrow('BLOCKED')
    expect(() => analyzer.registerDataset({ ...dataset, datasetId: 'DS_S', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('활용 기록 없으면 totalDownloads=0', () => {
    const report = analyzer.analyze('DS001')
    expect(report.totalDownloads).toBe(0)
    expect(report.totalApiCalls).toBe(0)
  })

  it('활용 증가 추세 → GROWING', () => {
    // 이전: 낮은 수치, 최근: 높은 수치
    analyzer.recordUtilization({ datasetId: 'DS001', timestamp: Date.now() - 2000, downloadCount: 10, apiCallCount: 10, uniqueConsumers: 2 })
    analyzer.recordUtilization({ datasetId: 'DS001', timestamp: Date.now() - 1000, downloadCount: 100, apiCallCount: 100, uniqueConsumers: 5 })
    const report = analyzer.analyze('DS001')
    expect(report.utilizationTrend).toBe('GROWING')
  })

  it('활용 감소 추세 → DECLINING + 권고사항', () => {
    analyzer.recordUtilization({ datasetId: 'DS001', timestamp: Date.now() - 2000, downloadCount: 100, apiCallCount: 100, uniqueConsumers: 5 })
    analyzer.recordUtilization({ datasetId: 'DS001', timestamp: Date.now() - 1000, downloadCount: 10, apiCallCount: 10, uniqueConsumers: 2 })
    const report = analyzer.analyze('DS001')
    expect(report.utilizationTrend).toBe('DECLINING')
    expect(report.recommendations.some((r) => r.includes('감소'))).toBe(true)
  })

  it('소수 소비자 (< 3) → 권고사항', () => {
    analyzer.recordUtilization({ datasetId: 'DS001', timestamp: Date.now(), downloadCount: 50, apiCallCount: 50, uniqueConsumers: 2 })
    const report = analyzer.analyze('DS001')
    expect(report.recommendations.some((r) => r.includes('소수'))).toBe(true)
  })

  it('미등록 데이터셋 에러', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    analyzer.analyze('DS001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'utilization.analyze')).toBe(true)
  })
})
