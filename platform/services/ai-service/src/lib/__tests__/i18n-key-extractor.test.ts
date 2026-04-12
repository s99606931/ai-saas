/**
 * Unit tests for i18n Key Extractor — SVC-AI-ADV-R107
 */

import { describe, it, expect } from 'vitest'
import { I18nKeyExtractor } from '../i18n-key-extractor'

describe('SVC-AI-ADV-R107 I18nKeyExtractor', () => {
  it('[FR-R107.1, FR-R107.2] extracts Korean strings only', () => {
    const source = `
      const msg = "안녕하세요"
      const url = "https://example.com"
      const num = "123"
      const greet = '반갑습니다'
    `
    const extractor = new I18nKeyExtractor()
    const results = extractor.extractStrings(source)
    expect(results.some((r) => r.text === '안녕하세요')).toBe(true)
    expect(results.some((r) => r.text === '반갑습니다')).toBe(true)
    expect(results.some((r) => r.text === 'https://example.com')).toBe(false)
    expect(results.some((r) => r.text === '123')).toBe(false)
  })

  it('[FR-R107.3] suggested keys are deterministic', () => {
    const extractor = new I18nKeyExtractor()
    const r1 = extractor.extractStrings('const a = "민원 신청"')
    const r2 = extractor.extractStrings('const b = "민원 신청"')
    expect(r1[0]!.suggestedKey).toBe(r2[0]!.suggestedKey)
  })

  it('[FR-R107.1] dedupes identical strings', () => {
    const source = 'const a = "동일"; const b = "동일";'
    const extractor = new I18nKeyExtractor()
    const results = extractor.extractStrings(source)
    const matches = results.filter((r) => r.text === '동일')
    expect(matches).toHaveLength(1)
  })

  it('[FR-R107.4] toBundle converts to key-value map', () => {
    const extractor = new I18nKeyExtractor()
    const occ = extractor.extractStrings('const x = "환영합니다"')
    const bundle = extractor.toBundle(occ)
    expect(Object.values(bundle)).toContain('환영합니다')
  })

  it('[FR-R107.5] diffBundles identifies missing and extra', () => {
    const extractor = new I18nKeyExtractor()
    const existing = { 'auto.111': '기존', 'auto.222': '삭제예정' }
    const extracted = { 'auto.111': '기존', 'auto.333': '신규' }
    const diff = extractor.diffBundles(existing, extracted)
    expect(diff.matched).toBe(1)
    expect(diff.missingKeys).toContain('auto.333')
    expect(diff.extraKeys).toContain('auto.222')
  })

  it('[FR-R107.1] ignores short strings', () => {
    const extractor = new I18nKeyExtractor()
    const results = extractor.extractStrings('const a = "가"')
    expect(results).toHaveLength(0)
  })

  it('[FR-R107.1] handles empty source', () => {
    const extractor = new I18nKeyExtractor()
    expect(extractor.extractStrings('')).toEqual([])
  })
})
