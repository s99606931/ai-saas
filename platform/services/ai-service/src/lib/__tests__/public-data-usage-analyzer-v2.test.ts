// Plan SC: SVC-AI-ADV-R585-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataUsageAnalyzerV2, type PublicDataset, type UsageRecord } from '../public-data-usage-analyzer-v2'

describe('PublicDataUsageAnalyzerV2', () => {
  let analyzer: PublicDataUsageAnalyzerV2

  const dataset: PublicDataset = {
    datasetId: 'DS-1', title: '서울시 민원 현황', category: '행정',
    grade: 'O', organization: '서울시', publishedAt: '2026-01-01',
  }

  const highUsageRecord: UsageRecord = {
    datasetId: 'DS-1', date: '2026-01-01',
    downloadCount: 80, apiCallCount: 50, uniqueUsers: 30,
  }

  beforeEach(() => {
    analyzer = new PublicDataUsageAnalyzerV2()
  })

  it('N2SF: C등급 데이터셋 등록 차단', () => {
    expect(() => analyzer.registerDataset({ ...dataset, datasetId: 'DS-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 데이터셋 등록 차단', () => {
    expect(() => analyzer.registerDataset({ ...dataset, datasetId: 'DS-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('미등록 데이터셋 분석 시 오류 발생', () => {
    expect(() => analyzer.analyzeUsage('UNKNOWN')).toThrow('Unknown dataset')
  })

  it('활용 없는 데이터셋 → UNUSED 등급', () => {
    analyzer.registerDataset(dataset)
    const analysis = analyzer.analyzeUsage('DS-1')
    expect(analysis.usageGrade).toBe('UNUSED')
  })

  it('평균 100+ 활용 → HIGH 등급', () => {
    analyzer.registerDataset(dataset)
    analyzer.recordUsage(highUsageRecord)
    const analysis = analyzer.analyzeUsage('DS-1')
    expect(analysis.usageGrade).toBe('HIGH')
    expect(analysis.totalDownloads).toBe(80)
  })

  it('증가 추세 감지', () => {
    analyzer.registerDataset(dataset)
    analyzer.recordUsage({ ...highUsageRecord, date: '2026-01-01', downloadCount: 10, apiCallCount: 5, uniqueUsers: 3 })
    analyzer.recordUsage({ ...highUsageRecord, date: '2026-01-02', downloadCount: 50, apiCallCount: 80, uniqueUsers: 20 })
    const analysis = analyzer.analyzeUsage('DS-1')
    expect(analysis.trend).toBe('INCREASING')
  })

  it('generateReport: topDatasets 활용도 높은 순', () => {
    analyzer.registerDataset(dataset)
    analyzer.registerDataset({ ...dataset, datasetId: 'DS-2', title: '경제 지표' })
    analyzer.recordUsage(highUsageRecord)
    const report = analyzer.generateReport()
    expect(report.totalDatasets).toBe(2)
    expect(report.topDatasets[0]).toBe('DS-1')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.registerDataset(dataset)
    analyzer.analyzeUsage('DS-1')
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', datasetId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
