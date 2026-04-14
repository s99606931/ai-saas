// Plan SC: SVC-AI-ADV-R522-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataSearchIntelligenceV2, type PublicDataset, type SearchQuery } from '../public-data-search-intelligence-v2'

describe('PublicDataSearchIntelligenceV2', () => {
  let searcher: PublicDataSearchIntelligenceV2

  const dataset: PublicDataset = {
    datasetId: 'DS-1',
    title: '서울시 민원 처리 현황',
    description: '서울시 행정 민원 처리 통계 데이터',
    tags: ['민원', '행정', '서울'],
    category: '행정',
    grade: 'O',
    downloadCount: 500,
    lastUpdatedDaysAgo: 15,
    organization: '서울시',
  }

  beforeEach(() => {
    searcher = new PublicDataSearchIntelligenceV2()
  })

  it('N2SF: C등급 데이터셋 등록 차단', () => {
    expect(() => searcher.registerDataset({ ...dataset, datasetId: 'DS-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 데이터셋 등록 차단', () => {
    expect(() => searcher.registerDataset({ ...dataset, datasetId: 'DS-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('데이터셋 없을 때 검색 → totalFound=0', () => {
    const result = searcher.search({ queryId: 'Q1', keywords: ['민원'] })
    expect(result.totalFound).toBe(0)
  })

  it('키워드 매칭 → 결과 반환', () => {
    searcher.registerDataset(dataset)
    const result = searcher.search({ queryId: 'Q1', keywords: ['민원'] })
    expect(result.totalFound).toBeGreaterThan(0)
    expect(result.results[0]?.datasetId).toBe('DS-1')
  })

  it('카테고리 필터 적용 → 해당 카테고리만 반환', () => {
    searcher.registerDataset(dataset)
    searcher.registerDataset({ ...dataset, datasetId: 'DS-2', category: '경제', title: '경제 지표' })
    const result = searcher.search({ queryId: 'Q2', keywords: [], categoryFilter: '행정' })
    expect(result.results.every((r) => r.datasetId === 'DS-1')).toBe(true)
  })

  it('maxResults 제한 적용', () => {
    for (let i = 0; i < 5; i++) {
      searcher.registerDataset({ ...dataset, datasetId: `DS-${i}`, title: `민원 데이터 ${i}` })
    }
    const result = searcher.search({ queryId: 'Q3', keywords: ['민원'], maxResults: 2 })
    expect(result.results.length).toBeLessThanOrEqual(2)
  })

  it('관련 검색어 제안 반환', () => {
    searcher.registerDataset(dataset)
    const result = searcher.search({ queryId: 'Q4', keywords: ['민원'] })
    expect(result.suggestions).toBeDefined()
    expect(result.generatedAt).toBeTruthy()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    searcher.registerDataset(dataset)
    searcher.search({ queryId: 'Q5', keywords: ['민원'] })
    const log1 = searcher.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', queryId: 'X', detail: {} })
    const log2 = searcher.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
