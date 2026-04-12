import { describe, it, expect, beforeEach } from 'vitest'
import { MultimodalPublicSearch } from '../multimodal-public-search'

describe('MultimodalPublicSearch', () => {
  let search: MultimodalPublicSearch

  beforeEach(() => {
    search = new MultimodalPublicSearch()
    search.indexDocument({ docId: 'DOC-1', title: '주민등록 발급 안내', content: '주민등록증 온라인 발급 절차', category: '민원', tags: ['주민', '발급'], modality: 'TEXT', grade: 'O' })
    search.indexDocument({ docId: 'DOC-2', title: '토지이용계획 확인원', content: '토지 이용계획 열람 방법', category: '지적', tags: ['토지', '지적'], modality: 'DOCUMENT', grade: 'O' })
    search.indexDocument({ docId: 'DOC-3', title: '행정지도 이미지', content: '행정구역 지도 이미지 데이터', category: '지도', tags: ['지도', '이미지'], modality: 'IMAGE', grade: 'O' })
  })

  it('N2SF C등급 문서 색인 차단', () => {
    expect(() => search.indexDocument({ docId: 'DOC-X', title: '기밀', content: '내용', category: '보안', tags: [], modality: 'TEXT', grade: 'C' })).toThrow('BLOCKED')
  })

  it('텍스트 검색 결과 반환', () => {
    const result = search.search({ queryId: 'Q1', text: '주민 발급' })
    expect(result.totalHits).toBeGreaterThan(0)
    expect(result.hits.some((h) => h.docId === 'DOC-1')).toBe(true)
  })

  it('모달리티 필터 적용', () => {
    const result = search.search({ queryId: 'Q2', text: '이미지 지도', modalities: ['IMAGE'] })
    expect(result.hits.every((h) => h.modality === 'IMAGE')).toBe(true)
  })

  it('카테고리 필터 적용', () => {
    const result = search.search({ queryId: 'Q3', text: '토지', category: '지적' })
    expect(result.hits.every((h) => h.docId === 'DOC-2')).toBe(true)
  })

  it('매칭 없으면 totalHits=0', () => {
    const result = search.search({ queryId: 'Q4', text: '전혀무관xyz' })
    expect(result.totalHits).toBe(0)
  })

  it('감사 로그 복사본 반환', () => {
    search.search({ queryId: 'Q5', text: '주민' })
    const log = search.getAuditLog()
    log.push({ timestamp: '', action: 'injected', queryId: 'X', detail: {} })
    expect(search.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
