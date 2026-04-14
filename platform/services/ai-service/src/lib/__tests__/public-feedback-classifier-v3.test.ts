// Plan SC: SVC-AI-ADV-R611
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicFeedbackClassifierV3 } from '../public-feedback-classifier-v3'

describe('PublicFeedbackClassifierV3', () => {
  let c: PublicFeedbackClassifierV3

  beforeEach(() => {
    c = new PublicFeedbackClassifierV3()
  })

  it('classify — COMPLAINT + NEGATIVE → HIGH', () => {
    const r = c.classify({ id: 'f1', authorContact: 'a@b.kr', content: '서비스에 큰 불만이 있고 오류가 많음' })
    expect(r.category).toBe('COMPLAINT')
    expect(r.sentiment).toBe('NEGATIVE')
    expect(r.priority).toBe('HIGH')
  })

  it('classify — PRAISE + POSITIVE → LOW', () => {
    const r = c.classify({ id: 'f2', authorContact: 'a@b.kr', content: '정말 감사하고 만족스럽습니다' })
    expect(r.category).toBe('PRAISE')
    expect(r.sentiment).toBe('POSITIVE')
    expect(r.priority).toBe('LOW')
  })

  it('classify — authorContact 마스킹 (16자 hex)', () => {
    const r = c.classify({ id: 'f3', authorContact: 'user@test.go.kr', content: '질문있어요?' })
    expect(r.authorMasked).toMatch(/^[0-9a-f]{16}$/)
    expect(r.authorMasked).not.toContain('user')
  })

  it('classify — C/S 등급 차단', () => {
    expect(() => c.classify({ id: 'f4', authorContact: 'x', content: '테스트' }, 'C')).toThrow(/BLOCKED/)
    expect(() => c.classify({ id: 'f4', authorContact: 'x', content: '테스트' }, 'S')).toThrow(/BLOCKED/)
  })

  it('getCategoryStats — 카테고리별 카운트', () => {
    c.classify({ id: 'f1', authorContact: 'x', content: '불만이 큽니다' })
    c.classify({ id: 'f2', authorContact: 'x', content: '개선 제안합니다' })
    c.classify({ id: 'f3', authorContact: 'x', content: '정말 감사합니다' })
    const s = c.getCategoryStats()
    expect(s.COMPLAINT).toBe(1)
    expect(s.SUGGESTION).toBe(1)
    expect(s.PRAISE).toBe(1)
  })

  it('getAuditLog — classify 마다 감사 기록', () => {
    c.classify({ id: 'f1', authorContact: 'x', content: '문의드립니다?' })
    const log = c.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('feedback.classify')
  })
})
