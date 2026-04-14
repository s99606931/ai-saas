import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceTranslatorV3 } from '../public-service-translator-v3'

describe('PublicServiceTranslatorV3', () => {
  let translator: PublicServiceTranslatorV3

  beforeEach(() => { translator = new PublicServiceTranslatorV3() })

  it('should register a language pair', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    expect(translator.getAverageQuality('ko-en')).toBe(0)
  })

  it('should record translation and compute average quality', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    translator.recordTranslation('ko-en', '안녕', 'Hello', 80)
    translator.recordTranslation('ko-en', '감사', 'Thanks', 90)
    expect(translator.getAverageQuality('ko-en')).toBe(85)
  })

  it('should identify low quality pairs (avg < 70)', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    translator.registerLanguagePair('ko-fr', 'ko', 'fr')
    translator.recordTranslation('ko-en', 'a', 'b', 50)
    translator.recordTranslation('ko-fr', 'a', 'b', 80)
    const low = translator.getLowQualityPairs()
    expect(low.map((p: { pairId: string }) => p.pairId)).toContain('ko-en')
    expect(low.map((p: { pairId: string }) => p.pairId)).not.toContain('ko-fr')
  })

  it('should block C grade data', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    expect(() => translator.recordTranslation('ko-en', 'a', 'b', 80, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    expect(() => translator.recordTranslation('ko-en', 'a', 'b', 80, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    translator.registerLanguagePair('ko-en', 'ko', 'en')
    translator.recordTranslation('ko-en', 'a', 'b', 75)
    expect(translator.getAuditLog().length).toBeGreaterThan(0)
  })
})
