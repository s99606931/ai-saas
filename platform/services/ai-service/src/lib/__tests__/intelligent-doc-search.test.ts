import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentDocSearch } from '../intelligent-doc-search'

describe('IntelligentDocSearch', () => {
  let s: IntelligentDocSearch

  beforeEach(() => {
    s = new IntelligentDocSearch()
    s.indexDocument(
      {
        docId: 'd1',
        title: '공공데이터 개방 정책',
        body: '공공데이터 개방은 투명성 제고와 행정 효율 향상을 목적으로 한다',
        tags: ['공공데이터', '정책'],
      },
      'O',
      'admin-1'
    )
    s.indexDocument(
      {
        docId: 'd2',
        title: '개인정보 보호법',
        body: '개인정보 처리시 보호 조치를 적용해야 한다',
        tags: ['보안', '개인정보'],
      },
      'O',
      'admin-1'
    )
    s.indexDocument(
      {
        docId: 'd3',
        title: '민원 처리 지침',
        body: '민원 처리 절차와 응답 시간 표준',
        tags: ['민원'],
      },
      'O',
      'admin-1'
    )
  })

  it('C등급 차단', () => {
    expect(() =>
      s.indexDocument(
        { docId: 'x', title: 't', body: 'b', tags: [] },
        'C',
        'a'
      )
    ).toThrow('BLOCKED')
  })

  it('빈 docId 차단', () => {
    expect(() =>
      s.indexDocument({ docId: '', title: 't', body: 'b', tags: [] }, 'O', 'a')
    ).toThrow('docId')
  })

  it('빈 title 차단', () => {
    expect(() =>
      s.indexDocument({ docId: 'x', title: '', body: 'b', tags: [] }, 'O', 'a')
    ).toThrow('title')
  })

  it('중복 docId 차단', () => {
    expect(() =>
      s.indexDocument(
        { docId: 'd1', title: 't', body: 'b', tags: [] },
        'O',
        'a'
      )
    ).toThrow('중복')
  })

  it('빈 query 차단', () => {
    expect(() => s.search('  ')).toThrow('query')
  })

  it('topN 양수 검증', () => {
    expect(() => s.search('test', { topN: 0 })).toThrow('topN')
  })

  it('검색 — 공공데이터', () => {
    const results = s.search('공공데이터')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0]?.docId).toBe('d1')
    expect(results[0]?.matchedTerms).toContain('공공데이터')
  })

  it('검색 — 매칭 없음', () => {
    const results = s.search('우주선')
    expect(results).toHaveLength(0)
  })

  it('태그 필터', () => {
    const results = s.search('처리', { tags: ['민원'] })
    expect(results.length).toBe(1)
    expect(results[0]?.docId).toBe('d3')
  })

  it('topN 제한', () => {
    const results = s.search('처리', { topN: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('점수 내림차순 정렬', () => {
    s.indexDocument(
      {
        docId: 'd4',
        title: '공공데이터 공공데이터 공공데이터',
        body: '공공데이터 활용 사례',
        tags: ['공공데이터'],
      },
      'O',
      'a'
    )
    const results = s.search('공공데이터')
    if (results.length >= 2) {
      const first = results[0]?.score ?? 0
      const second = results[1]?.score ?? 0
      expect(first).toBeGreaterThanOrEqual(second)
    }
  })

  it('deleteDocument', () => {
    s.deleteDocument('d1', 'admin')
    expect(s.getDocCount()).toBe(2)
  })

  it('없는 doc 삭제 오류', () => {
    expect(() => s.deleteDocument('none', 'a')).toThrow('docId 없음')
  })

  it('빈 검색 인덱스', () => {
    const empty = new IntelligentDocSearch()
    expect(empty.search('test')).toHaveLength(0)
  })

  it('감사 로그 — 인덱싱/검색', () => {
    s.search('테스트')
    const log = s.getAuditLog()
    expect(log.some((e) => e.action === 'doc.index')).toBe(true)
    expect(log.some((e) => e.action === 'search')).toBe(true)
  })
})
