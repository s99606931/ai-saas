import { describe, it, expect, beforeEach } from 'vitest'
import { KnowledgeBaseBuilderAI } from '../knowledge-base-builder-ai'

describe('KnowledgeBaseBuilderAI', () => {
  let builder: KnowledgeBaseBuilderAI

  beforeEach(() => {
    builder = new KnowledgeBaseBuilderAI()
    builder.ingest({ docId: 'D-1', title: '민원 처리 지침', content: '민원 접수 후 처리 절차 안내', tags: ['민원', '처리'], grade: 'O', source: '행안부' })
    builder.ingest({ docId: 'D-2', title: '개인정보 보호법', content: '개인정보 수집 이용 제공 안내', tags: ['개인정보', '법령'], grade: 'O', source: '국회' })
  })

  it('N2SF C등급 문서 색인 차단', () => {
    expect(() => builder.ingest({ docId: 'D-X', title: '기밀', content: '내용', tags: [], grade: 'C', source: '내부' })).toThrow('BLOCKED')
  })

  it('S등급 문서 색인 차단', () => {
    expect(() => builder.ingest({ docId: 'D-Y', title: '비밀', content: '내용', tags: [], grade: 'S', source: '내부' })).toThrow('BLOCKED')
  })

  it('문서 색인 후 INDEXED 상태', () => {
    const entry = builder.getEntry('D-1')
    expect(entry.status).toBe('INDEXED')
    expect(entry.wordCount).toBeGreaterThan(0)
  })

  it('키워드 검색 결과 반환', () => {
    const results = builder.search('민원 처리')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.docId).toBe('D-1')
  })

  it('관련 없는 검색어 — 결과 없음', () => {
    const results = builder.search('무관한검색어xyz')
    expect(results.length).toBe(0)
  })

  it('알 수 없는 문서 조회 시 오류', () => {
    expect(() => builder.getEntry('UNKNOWN')).toThrow('Unknown document')
  })

  it('감사 로그 복사본 반환', () => {
    builder.search('민원')
    const log = builder.getAuditLog()
    log.push({ timestamp: '', action: 'injected', docId: 'X', detail: {} })
    expect(builder.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
