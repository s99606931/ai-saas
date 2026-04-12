import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataCatalogAI } from '../public-data-catalog-ai'

describe('PublicDataCatalogAI', () => {
  let catalog: PublicDataCatalogAI

  beforeEach(() => {
    catalog = new PublicDataCatalogAI()
    catalog.catalog_dataset({ datasetId: 'DS-1', name: '서울 교통 현황', description: '서울시 버스 및 지하철 이용 현황 데이터입니다. 교통 통계 분석용.', provider: '서울시', format: 'CSV', grade: 'O', tags: ['교통', '버스', '지하철'], sampleFields: ['날짜', '노선', '승객수', '운행수', '혼잡도'], updateFrequency: 'DAILY' })
    catalog.catalog_dataset({ datasetId: 'DS-2', name: '대기질 측정 데이터', description: '전국 미세먼지 및 대기 오염 측정값', provider: '환경부', format: 'JSON', grade: 'O', tags: ['환경', '대기', '미세먼지'], sampleFields: ['측정소', 'PM10', 'PM2.5', '날짜', '등급'], updateFrequency: 'REALTIME' })
  })

  it('N2SF C등급 데이터셋 카탈로그 차단', () => {
    expect(() => catalog.catalog_dataset({ datasetId: 'DS-X', name: '기밀', description: '내용', provider: '내부', format: 'CSV', grade: 'C', tags: [], sampleFields: [], updateFrequency: 'MONTHLY' })).toThrow('BLOCKED')
  })

  it('카테고리 자동 추론 — 교통', () => {
    const entry = catalog.catalog_dataset({ datasetId: 'DS-3', name: '도로 파손 현황', description: '도로 파손 및 보수 현황', provider: '국토부', format: 'CSV', grade: 'O', tags: ['도로', '교통'], sampleFields: ['위치', '등급', '날짜'], updateFrequency: 'WEEKLY' })
    expect(entry.inferredCategory).toBe('교통')
  })

  it('품질 점수 계산 — 높은 점수', () => {
    const entry = catalog.catalog_dataset({ datasetId: 'DS-4', name: '복지 현황', description: '사회복지 서비스 이용 현황 통계로 다양한 복지 지표를 포함합니다.', provider: '복지부', format: 'JSON', grade: 'O', tags: ['복지', '사회', '의료'], sampleFields: ['기관', '서비스', '이용자수', '예산', '지역'], updateFrequency: 'DAILY' })
    expect(entry.qualityScore).toBeGreaterThanOrEqual(80)
    expect(entry.openDataEligible).toBe(true)
  })

  it('검색 결과 반환', () => {
    const results = catalog.search('교통 버스')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.datasetId).toBe('DS-1')
  })

  it('관련 없는 검색어 — 빈 결과', () => {
    const results = catalog.search('전혀무관한xyz')
    expect(results.length).toBe(0)
  })

  it('감사 로그 복사본 반환', () => {
    catalog.search('환경')
    const log = catalog.getAuditLog()
    log.push({ timestamp: '', action: 'injected', datasetId: 'X', detail: {} })
    expect(catalog.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
