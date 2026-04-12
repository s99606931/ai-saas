import { describe, it, expect, beforeEach } from 'vitest'
import { LegalChangeImpactTracker } from '../legal-change-impact-tracker'

describe('LegalChangeImpactTracker', () => {
  let tracker: LegalChangeImpactTracker

  beforeEach(() => {
    tracker = new LegalChangeImpactTracker()
    tracker.registerArticle({ articleId: 'LAW-1', lawName: '개인정보보호법', content: '제1조 내용', effectiveDate: '2026-01-01' })
    tracker.registerArticle({ articleId: 'LAW-2', lawName: '전자정부법', content: '제2조 내용', effectiveDate: '2026-01-01' })
    tracker.registerSystem({ systemId: 'SYS-1', name: '민원시스템', referencedArticleIds: ['LAW-1', 'LAW-2'] })
    tracker.registerSystem({ systemId: 'SYS-2', name: '행정시스템', referencedArticleIds: ['LAW-1'] })
    tracker.registerSystem({ systemId: 'SYS-3', name: '무관시스템', referencedArticleIds: ['LAW-3'] })
  })

  it('알 수 없는 법령 개정 시 오류', () => {
    expect(() => tracker.recordRevision({ articleId: 'UNKNOWN', previousContent: '기존', newContent: '개정', revisedAt: '2026-04-01', reason: '테스트' })).toThrow('Unknown article')
  })

  it('법령 변경 시 참조 시스템 탐지', () => {
    const report = tracker.recordRevision({ articleId: 'LAW-1', previousContent: '기존 내용', newContent: '개정 내용', revisedAt: '2026-04-01', reason: '법 개정' })
    expect(report.totalImpacted).toBe(2)
    expect(report.affectedSystems.map((s) => s.systemId)).toContain('SYS-1')
    expect(report.affectedSystems.map((s) => s.systemId)).toContain('SYS-2')
    expect(report.affectedSystems.map((s) => s.systemId)).not.toContain('SYS-3')
  })

  it('영향 없는 법령 변경 시 totalImpacted=0', () => {
    const report = tracker.recordRevision({ articleId: 'LAW-2', previousContent: '기존', newContent: '개정', revisedAt: '2026-04-01', reason: '개정' })
    expect(report.affectedSystems.some((s) => s.systemId === 'SYS-3')).toBe(false)
  })

  it('개정 이력 조회', () => {
    tracker.recordRevision({ articleId: 'LAW-1', previousContent: 'v1', newContent: 'v2', revisedAt: '2026-03-01', reason: '1차' })
    tracker.recordRevision({ articleId: 'LAW-1', previousContent: 'v2', newContent: 'v3', revisedAt: '2026-04-01', reason: '2차' })
    const history = tracker.getRevisionHistory('LAW-1')
    expect(history.length).toBe(2)
  })

  it('빈 개정 이력', () => {
    expect(tracker.getRevisionHistory('LAW-2')).toEqual([])
  })

  it('감사 로그 복사본 반환', () => {
    tracker.recordRevision({ articleId: 'LAW-1', previousContent: '기존', newContent: '개정', revisedAt: '2026-04-01', reason: '개정' })
    const log = tracker.getAuditLog()
    log.push({ timestamp: '', action: 'injected', articleId: 'X', detail: {} })
    expect(tracker.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
