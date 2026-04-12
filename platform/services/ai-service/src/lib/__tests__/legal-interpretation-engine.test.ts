/**
 * AI 법령 해석 엔진 단위 테스트 — SVC-AI-ADV-R154
 * Plan SC: FR-R154.1 ~ FR-R154.7
 */

import { describe, it, expect } from 'vitest'
import { LegalInterpretationEngine, DataGrade } from '../legal-interpretation-engine'

describe('LegalInterpretationEngine — R154', () => {
  it('FR-R154.1: 법령 조문 등록', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    expect(() =>
      eng.registerArticle({ id: 'a1', lawName: '개인정보보호법', articleNo: '15', content: '개인정보의 수집·이용', keywords: ['개인정보', '수집'] })
    ).not.toThrow()
    const log = eng.getAuditLog()
    expect(log[0]?.action).toBe('articleRegistered')
  })

  it('FR-R154.2: 관련 조문 검색', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    eng.registerArticle({ id: 'a1', lawName: '개인정보보호법', articleNo: '15', content: '개인정보의 수집 및 이용에 관한 사항' })
    eng.registerArticle({ id: 'a2', lawName: '전자정부법', articleNo: '3', content: '행정기관의 정보시스템 구축 및 운영' })
    const result = eng.query('개인정보 수집 동의')
    expect(result.articles.length).toBeGreaterThan(0)
    expect(result.articles[0]!.article.id).toBe('a1')
  })

  it('FR-R154.3: 해석 문자열 생성', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    eng.registerArticle({ id: 'a1', lawName: '행정기본법', articleNo: '8', content: '행정청의 의무에 관한 규정' })
    const result = eng.query('행정청 의무')
    expect(result.interpretation).toContain('행정기본법')
  })

  it('FR-R154.4: 신뢰도 점수 0~1', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    eng.registerArticle({ id: 'a1', lawName: '법', articleNo: '1', content: '테스트 조문' })
    const result = eng.query('테스트')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('조문 없을 때 confidence=0, 안내 문자열 반환', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    const result = eng.query('전혀 관련 없는 쿼리')
    expect(result.confidence).toBe(0)
    expect(result.interpretation).toContain('찾을 수 없습니다')
  })

  it('FR-R154.6: PII 마스킹 (이메일)', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    const result = eng.query('user@example.com 관련 법령')
    expect(result.maskedQuery).toContain('[EMAIL]')
    expect(result.maskedQuery).not.toContain('user@example.com')
  })

  it('FR-R154.5: C 등급 차단', () => {
    expect(() => new LegalInterpretationEngine(DataGrade.C)).toThrow('BLOCKED')
    expect(() => new LegalInterpretationEngine(DataGrade.S)).toThrow('BLOCKED')
  })

  it('FR-R154.7: getAuditLog append-only', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    eng.registerArticle({ id: 'a1', lawName: '법', articleNo: '1', content: '내용' })
    const log1 = eng.getAuditLog()
    // readonly 배열 — 외부에서 변경 시도 불가(타입 시스템 강제)
    ;(log1 as unknown as { push: (e: unknown) => void }).push({
      action: 'queried',
      timestamp: 0,
      details: {},
    })
    const log2 = eng.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('빈 id 등록 throw', () => {
    const eng = new LegalInterpretationEngine(DataGrade.O)
    expect(() => eng.registerArticle({ id: '', lawName: '법', articleNo: '1', content: '내용' })).toThrow('must not be empty')
  })
})
