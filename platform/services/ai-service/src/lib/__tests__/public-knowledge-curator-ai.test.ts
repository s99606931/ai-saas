import { describe, it, expect, beforeEach } from 'vitest'
import { PublicKnowledgeCuratorAI } from '../public-knowledge-curator-ai'

describe('PublicKnowledgeCuratorAI', () => {
  let curator: PublicKnowledgeCuratorAI

  beforeEach(() => {
    curator = new PublicKnowledgeCuratorAI()
  })

  it('N2SF C/S 등급 차단', () => {
    expect(() => curator.ingest({ articleId: 'A-X', title: '기밀', content: '내용', contentType: 'GUIDE', grade: 'C', tags: [], publishedAt: '2026-01-01', updatedAt: '2026-01-01', viewCount: 0 })).toThrow('BLOCKED')
  })

  it('알 수 없는 아티클 큐레이션 시 오류', () => {
    expect(() => curator.curate('UNKNOWN')).toThrow('Unknown article')
  })

  it('고품질 문서 — APPROVED', () => {
    curator.ingest({ articleId: 'A-1', title: '민원 처리 지침 안내서', content: '민원 처리 절차에 대한 상세한 가이드입니다. 이 문서는 공공기관 담당자가 민원을 효율적으로 처리하는 방법을 설명합니다. 총 10단계 절차를 포함합니다.', contentType: 'GUIDE', grade: 'O', tags: ['민원', '행정', '처리절차'], publishedAt: '2026-01-01', updatedAt: '2026-04-01', viewCount: 100 })
    const result = curator.curate('A-1')
    expect(result.status).toBe('APPROVED')
    expect(result.qualityScore).toBeGreaterThanOrEqual(70)
  })

  it('콘텐츠 너무 짧음 — REJECTED 또는 PENDING_REVIEW', () => {
    curator.ingest({ articleId: 'A-2', title: '짧음', content: '짧은 내용', contentType: 'FAQ', grade: 'O', tags: [], publishedAt: '2026-01-01', updatedAt: '2026-01-01', viewCount: 0 })
    const result = curator.curate('A-2')
    expect(['REJECTED', 'PENDING_REVIEW']).toContain(result.status)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('장기 미업데이트 문서 — OUTDATED', () => {
    curator.ingest({ articleId: 'A-3', title: '오래된 민원 안내서', content: '민원 처리에 관한 구 안내서입니다. 오래된 내용이 포함되어 있을 수 있습니다. 담당자에게 문의하세요.', contentType: 'GUIDE', grade: 'O', tags: ['민원'], publishedAt: '2022-01-01', updatedAt: '2022-01-01', viewCount: 10 })
    const result = curator.curate('A-3')
    expect(result.status).toBe('OUTDATED')
  })

  it('검색 결과 반환', () => {
    curator.ingest({ articleId: 'A-4', title: '보안 정책 가이드', content: '공공기관 CSAP 보안 정책 및 N2SF 요건을 설명합니다. 상세한 적용 방법을 포함합니다.', contentType: 'REGULATION', grade: 'O', tags: ['보안', 'CSAP'], publishedAt: '2026-01-01', updatedAt: '2026-04-01', viewCount: 50 })
    const results = curator.search('보안 CSAP')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.articleId).toBe('A-4')
  })

  it('태그 자동 제안', () => {
    curator.ingest({ articleId: 'A-5', title: '행정 결재 절차 안내', content: '공문서 기안 및 결재 프로세스를 설명합니다. 전자 결재 시스템 사용 방법을 포함합니다.', contentType: 'PROCEDURE', grade: 'O', tags: [], publishedAt: '2026-01-01', updatedAt: '2026-04-01', viewCount: 20 })
    const result = curator.curate('A-5')
    expect(result.suggestedTags.some((t) => t === '행정')).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    curator.ingest({ articleId: 'A-6', title: '테스트 제목 안내', content: '이것은 테스트 문서입니다. 충분한 내용을 포함합니다. 감사 로그 검증을 위한 문서입니다.', contentType: 'FAQ', grade: 'O', tags: ['테스트'], publishedAt: '2026-01-01', updatedAt: '2026-04-01', viewCount: 5 })
    curator.curate('A-6')
    const log = curator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', articleId: 'X', detail: {} })
    expect(curator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
