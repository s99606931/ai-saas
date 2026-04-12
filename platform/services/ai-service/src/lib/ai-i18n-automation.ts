/**
 * AI i18n Automation — SVC-AI-ADV-R111 (트랙 B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R111.design.md
 * Plan SC: FR-R111.1 ~ FR-R111.5
 *
 * 코드베이스 i18n 키 자동 추출 + 번역 누락 탐지 + 번역 제안 생성.
 * 규칙 기반 — LLM/외부 API 없음. CSAP D-06 감사 로그.
 */

// Design Ref: §2 — 타입 정의

export type Locale = string

export interface I18nKey {
  key: string
  namespace?: string
  occurrences: number
  sources: string[]
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string
  }
}

export interface MissingTranslation {
  key: string
  missingLocales: Locale[]
  existingLocales: Locale[]
}

export interface TranslationSuggestion {
  key: string
  locale: Locale
  suggested: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  method: 'PASSTHROUGH' | 'KEY_TRANSFORM' | 'FALLBACK'
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 — 기본 i18n 키 추출 패턴
const DEFAULT_I18N_PATTERN = /t\(['"]([^'"]+)['"]\)/g

export class AiI18nAutomation {
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R111.1 — Design Ref: §3.1 키 추출
  extractKeys(code: string, pattern?: RegExp, source?: string): I18nKey[] {
    const regex = pattern ?? DEFAULT_I18N_PATTERN
    regex.lastIndex = 0
    const keyMap = new Map<string, I18nKey>()

    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) !== null) {
      const rawKey = match[1]
      if (!rawKey) continue

      const { namespace } = this.parseNamespacedKey(rawKey)
      const fullKey = rawKey

      const existing = keyMap.get(fullKey)
      if (existing) {
        existing.occurrences++
        if (source && !existing.sources.includes(source)) {
          existing.sources.push(source)
        }
      } else {
        keyMap.set(fullKey, {
          key: fullKey,
          namespace,
          occurrences: 1,
          sources: source ? [source] : [],
        })
      }
    }

    const keys = [...keyMap.values()]
    this.appendAudit('keys.extract', { count: keys.length, source: source ?? 'inline' })
    return keys
  }

  // Plan SC: FR-R111.2 — Design Ref: §3.2 누락 번역 탐지
  findMissingTranslations(
    keys: I18nKey[],
    translations: TranslationMap,
    baseLocale: Locale = 'ko',
  ): MissingTranslation[] {
    const allLocales = Object.keys(translations)
    const missing: MissingTranslation[] = []

    for (const keyEntry of keys) {
      const missingLocales: Locale[] = []
      const existingLocales: Locale[] = []

      for (const locale of allLocales) {
        const localeTranslations = translations[locale]
        if (localeTranslations && localeTranslations[keyEntry.key] !== undefined) {
          existingLocales.push(locale)
        } else {
          missingLocales.push(locale)
        }
      }

      if (missingLocales.length > 0) {
        missing.push({
          key: keyEntry.key,
          missingLocales,
          existingLocales,
        })
      }
    }

    this.appendAudit('missing.find', {
      totalKeys: keys.length,
      missingCount: missing.length,
      baseLocale,
    })
    return missing
  }

  // Plan SC: FR-R111.3 — Design Ref: §3.3 번역 제안 (규칙 기반)
  suggestTranslation(
    key: string,
    locale: Locale,
    translations: TranslationMap,
  ): TranslationSuggestion {
    // PASSTHROUGH: 다른 로케일에 값이 있으면 그대로 복사 (HIGH 신뢰도)
    for (const [existingLocale, localeMap] of Object.entries(translations)) {
      if (existingLocale !== locale && localeMap[key] !== undefined) {
        return {
          key,
          locale,
          suggested: localeMap[key]!,
          confidence: 'HIGH',
          method: 'PASSTHROUGH',
        }
      }
    }

    // KEY_TRANSFORM: 키를 사람이 읽을 수 있게 변환 (MEDIUM 신뢰도)
    const { key: rawKey } = this.parseNamespacedKey(key)
    const transformed = rawKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/[._-]+/g, ' ')
      .trim()
      .toLowerCase()
    if (transformed !== rawKey.toLowerCase()) {
      return {
        key,
        locale,
        suggested: transformed,
        confidence: 'MEDIUM',
        method: 'KEY_TRANSFORM',
      }
    }

    // FALLBACK: 키 자체 반환 (LOW 신뢰도)
    return {
      key,
      locale,
      suggested: rawKey,
      confidence: 'LOW',
      method: 'FALLBACK',
    }
  }

  // Plan SC: FR-R111.4 — Design Ref: §3.4 번역 병합
  mergeTranslations(base: TranslationMap, additions: TranslationMap): TranslationMap {
    const result: TranslationMap = {}

    // base 복사
    for (const [locale, map] of Object.entries(base)) {
      result[locale] = { ...map }
    }

    // additions deep merge (덮어쓰기)
    for (const [locale, map] of Object.entries(additions)) {
      if (!result[locale]) {
        result[locale] = {}
      }
      for (const [key, value] of Object.entries(map)) {
        result[locale]![key] = value
      }
    }

    const addedKeys = Object.values(additions).reduce((sum, m) => sum + Object.keys(m).length, 0)
    this.appendAudit('translations.merge', {
      locales: Object.keys(result).length,
      addedKeys,
    })
    return result
  }

  // Plan SC: FR-R111.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // Design Ref: §3.1 — 네임스페이스 키 파싱 (예: "common:button.save")
  private parseNamespacedKey(rawKey: string): { namespace: string | undefined; key: string } {
    const colonIdx = rawKey.indexOf(':')
    if (colonIdx !== -1) {
      return {
        namespace: rawKey.slice(0, colonIdx),
        key: rawKey.slice(colonIdx + 1),
      }
    }
    return { namespace: undefined, key: rawKey }
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    })
  }
}
