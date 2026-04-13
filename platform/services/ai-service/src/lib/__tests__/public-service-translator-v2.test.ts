import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceTranslatorV2 } from '../public-service-translator-v2'

describe('PublicServiceTranslatorV2', () => {
  let ai: PublicServiceTranslatorV2

  beforeEach(() => {
    ai = new PublicServiceTranslatorV2()
    ai.registerGlossary('g1', 'ko', 'en', [
      { sourceTerms: ['주민등록번호', '주민번호'], targetTerm: 'Resident Registration Number' },
      { sourceTerms: ['행정안전부'], targetTerm: 'Ministry of Interior' },
    ])
  })

  it('용어집 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'glossary.register')).toBe(true)
  })

  it('용어집 기반 번역 치환', () => {
    const result = ai.translate('g1', '주민등록번호를 입력하세요')
    expect(result.translatedText).toContain('Resident Registration Number')
    expect(result.glossaryHits).toBe(1)
  })

  it('복수 용어 치환 — qualityScore 증가', () => {
    const result = ai.translate('g1', '행정안전부에서 주민등록번호를 관리합니다')
    expect(result.glossaryHits).toBe(2)
    expect(result.qualityScore).toBe(90)
  })

  it('용어집 미매칭 — 원문 반환, baseScore=50', () => {
    const result = ai.translate('g1', '일반 텍스트입니다')
    expect(result.translatedText).toBe('일반 텍스트입니다')
    expect(result.qualityScore).toBe(50)
  })

  it('품질 점수 상한 100', () => {
    ai.registerGlossary('g2', 'ko', 'en', [
      { sourceTerms: ['A'], targetTerm: 'a' },
      { sourceTerms: ['B'], targetTerm: 'b' },
      { sourceTerms: ['C'], targetTerm: 'c' },
      { sourceTerms: ['D'], targetTerm: 'd' },
    ])
    const result = ai.translate('g2', 'A B C D')
    expect(result.qualityScore).toBe(100)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.translate('g1', '텍스트', 'C')).toThrow('BLOCKED')
  })

  it('미등록 용어집 에러', () => {
    expect(() => ai.translate('unknown', '텍스트')).toThrow()
  })

  it('번역 품질 점수 조회', () => {
    const result = ai.translate('g1', '주민등록번호')
    expect(ai.getQualityScore(result.translationId)).toBe(result.qualityScore)
  })
})
