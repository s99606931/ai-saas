/**
 * Unit tests — AI i18n Automation (SVC-AI-ADV-R111 트랙B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R111.design.md
 * Plan SC: FR-R111.1 ~ FR-R111.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AiI18nAutomation, type TranslationMap } from '../ai-i18n-automation'

describe('SVC-AI-ADV-R111 AiI18nAutomation', () => {
  let i18n: AiI18nAutomation

  beforeEach(() => {
    i18n = new AiI18nAutomation()
  })

  it('[FR-R111.1] t() 함수 호출에서 키 추출', () => {
    const code = `
const label = t('button.save')
const title = t('page.title')
const msg = t("error.notFound")
`
    const keys = i18n.extractKeys(code)
    expect(keys).toHaveLength(3)
    const keyStrings = keys.map((k) => k.key)
    expect(keyStrings).toContain('button.save')
    expect(keyStrings).toContain('page.title')
    expect(keyStrings).toContain('error.notFound')
  })

  it('[FR-R111.1] 중복 키 occurrences 카운트', () => {
    const code = `t('button.save') + t('button.save') + t('page.title')`
    const keys = i18n.extractKeys(code)
    const saveKey = keys.find((k) => k.key === 'button.save')
    expect(saveKey!.occurrences).toBe(2)
  })

  it('[FR-R111.2] 누락 번역 탐지', () => {
    const keys = [
      { key: 'button.save', occurrences: 1, sources: [] },
      { key: 'button.cancel', occurrences: 1, sources: [] },
    ]
    const translations: TranslationMap = {
      ko: { 'button.save': '저장', 'button.cancel': '취소' },
      en: { 'button.save': 'Save' }, // button.cancel 누락
    }
    const missing = i18n.findMissingTranslations(keys, translations)
    expect(missing).toHaveLength(1)
    expect(missing[0]!.key).toBe('button.cancel')
    expect(missing[0]!.missingLocales).toContain('en')
    expect(missing[0]!.existingLocales).toContain('ko')
  })

  it('[FR-R111.3] PASSTHROUGH 번역 제안 — 다른 로케일 값 복사', () => {
    const translations: TranslationMap = {
      ko: { 'button.save': '저장' },
      en: {},
    }
    const suggestion = i18n.suggestTranslation('button.save', 'en', translations)
    expect(suggestion.method).toBe('PASSTHROUGH')
    expect(suggestion.suggested).toBe('저장')
    expect(suggestion.confidence).toBe('HIGH')
  })

  it('[FR-R111.3] KEY_TRANSFORM 제안 — camelCase 변환', () => {
    const translations: TranslationMap = { ko: {}, en: {} }
    const suggestion = i18n.suggestTranslation('buttonSaveLabel', 'ko', translations)
    expect(suggestion.method).toBe('KEY_TRANSFORM')
    expect(suggestion.confidence).toBe('MEDIUM')
  })

  it('[FR-R111.3] FALLBACK 제안 — 변환 불가 시 키 반환', () => {
    const translations: TranslationMap = {}
    const suggestion = i18n.suggestTranslation('x', 'ko', translations)
    expect(suggestion.method).toBe('FALLBACK')
    expect(suggestion.confidence).toBe('LOW')
    expect(suggestion.suggested).toBe('x')
  })

  it('[FR-R111.4] 번역 병합 — additions 우선 덮어쓰기', () => {
    const base: TranslationMap = {
      ko: { 'button.save': '저장', 'button.cancel': '취소' },
    }
    const additions: TranslationMap = {
      ko: { 'button.save': '보관' }, // 덮어쓰기
      en: { 'button.save': 'Save' }, // 신규 로케일
    }
    const merged = i18n.mergeTranslations(base, additions)
    expect(merged['ko']!['button.save']).toBe('보관')
    expect(merged['ko']!['button.cancel']).toBe('취소')
    expect(merged['en']!['button.save']).toBe('Save')
  })

  it('[FR-R111.5] CSAP D-06 감사 로그 append-only', () => {
    i18n.extractKeys(`t('key.one')`)
    i18n.findMissingTranslations([{ key: 'key.one', occurrences: 1, sources: [] }], {})
    const log = i18n.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
    // append-only 검증
    const copy = i18n.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', detail: {} })
    expect(i18n.getAuditLog().length).toBe(log.length)
  })
})
