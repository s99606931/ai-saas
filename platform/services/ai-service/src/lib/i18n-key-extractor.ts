/**
 * i18n Key Extractor — SVC-AI-ADV-R107
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R107.design.md
 * Plan SC: FR-R107.1 ~ FR-R107.5
 *
 * 코드에서 하드코딩된 한글 문자열을 추출해 i18n 리소스 번들로 변환.
 */

export interface StringOccurrence {
  text: string
  hasKorean: boolean
  suggestedKey: string
  context: string
}

export interface BundleDiff {
  missingKeys: string[]
  extraKeys: string[]
  matched: number
}

const STRING_REGEX = /['"`]([^'"`\n]{2,200})['"`]/g
const KOREAN_REGEX = /[\uAC00-\uD7AF]/
const URL_REGEX = /^https?:\/\//
const NUMERIC_REGEX = /^\d+$/

function djb2(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(16).slice(0, 8)
}

export class I18nKeyExtractor {
  /**
   * FR-R107.1, FR-R107.2, FR-R107.3: 소스에서 문자열 추출.
   */
  extractStrings(source: string): StringOccurrence[] {
    const results = new Map<string, StringOccurrence>()
    STRING_REGEX.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = STRING_REGEX.exec(source)) !== null) {
      const text = m[1]!.trim()
      if (text.length < 2) continue
      if (NUMERIC_REGEX.test(text)) continue
      if (URL_REGEX.test(text)) continue
      const hasKorean = KOREAN_REGEX.test(text)
      if (!hasKorean) continue // 공공 SaaS 한국어 전용
      const suggestedKey = `auto.${djb2(text)}`
      if (!results.has(text)) {
        results.set(text, {
          text,
          hasKorean,
          suggestedKey,
          context: source.slice(Math.max(0, m.index - 20), m.index + 20),
        })
      }
    }
    return Array.from(results.values())
  }

  /**
   * FR-R107.4: 점유율을 리소스 번들로 변환.
   */
  toBundle(occurrences: StringOccurrence[]): Record<string, string> {
    const bundle: Record<string, string> = {}
    for (const occ of occurrences) {
      bundle[occ.suggestedKey] = occ.text
    }
    return bundle
  }

  /**
   * FR-R107.5: 기존 번들과 비교.
   */
  diffBundles(
    existing: Record<string, string>,
    extracted: Record<string, string>,
  ): BundleDiff {
    const existingKeys = new Set(Object.keys(existing))
    const extractedKeys = new Set(Object.keys(extracted))
    const missingKeys = Array.from(extractedKeys).filter(
      (k) => !existingKeys.has(k),
    )
    const extraKeys = Array.from(existingKeys).filter(
      (k) => !extractedKeys.has(k),
    )
    const matched = Array.from(extractedKeys).filter((k) =>
      existingKeys.has(k),
    ).length
    return { missingKeys, extraKeys, matched }
  }
}
