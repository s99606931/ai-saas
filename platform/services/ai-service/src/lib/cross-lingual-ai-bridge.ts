/**
 * Cross-Lingual AI Bridge — SVC-AI-ADV-R117
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R117.design.md
 * Plan SC: FR-R117.1 ~ FR-R117.8
 *
 * 한국어 ↔ 다국어 번역 + 공공기관 용어 보존.
 * CSAP D-06 감사, D-09 PII 마스킹, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type Lang = 'ko' | 'en' | 'zh' | 'ja'

export interface GlossaryEntry {
  ko: string
  en?: string
  zh?: string
  ja?: string
}

export interface TranslateRequest {
  text: string
  targetLang: Lang
  grade: DataGrade
  dualText?: boolean
}

export interface TranslateResult {
  sourceLang: Lang
  targetLang: Lang
  text: string
  original?: string
  confidence: number
  glossaryApplied: number
  piiMasked: number
}

export interface BridgeOptions {
  glossary?: GlossaryEntry[]
  translator?: (
    text: string,
    to: Lang,
  ) => Promise<{ text: string; confidence: number }>
}

export interface BridgeAuditEntry {
  timestamp: string
  action:
    | 'translate'
    | 'gradeBlocked'
    | 'piiMasked'
    | 'glossaryApplied'
    | 'detectLang'
  detail?: Record<string, unknown>
}

const DEFAULT_GLOSSARY: GlossaryEntry[] = [
  {
    ko: '행정안전부',
    en: 'Ministry of the Interior and Safety',
    ja: '行政安全部',
    zh: '行政安全部',
  },
  {
    ko: '개인정보보호법',
    en: 'Personal Information Protection Act',
    ja: '個人情報保護法',
    zh: '个人信息保护法',
  },
  {
    ko: '정부24',
    en: 'Government24',
    ja: 'Government24',
    zh: 'Government24',
  },
  {
    ko: '국가정보원',
    en: 'National Intelligence Service',
    ja: '国家情報院',
    zh: '国家情报院',
  },
  {
    ko: '국가사이버안보센터',
    en: 'National Cyber Security Center',
    ja: '国家サイバー安全保障センター',
    zh: '国家网络安全中心',
  },
  {
    ko: '정보통신망법',
    en: 'Information and Communications Network Act',
    ja: '情報通信網法',
    zh: '信息通信网络法',
  },
  {
    ko: '공공기관',
    en: 'public institution',
    ja: '公共機関',
    zh: '公共机构',
  },
  {
    ko: '클라우드보안인증',
    en: 'Cloud Security Assurance Program',
    ja: 'クラウドセキュリティ認証',
    zh: '云安全认证',
  },
]

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: '[EMAIL]',
  },
  {
    pattern: /\b\d{6}[-]?\d{7}\b/g,
    replacement: '[RRN]',
  },
  {
    pattern: /\b01[0-9]-?\d{3,4}-?\d{4}\b/g,
    replacement: '[PHONE]',
  },
]

async function defaultTranslator(
  text: string,
  _to: Lang,
): Promise<{ text: string; confidence: number }> {
  // 플레이스홀더 구현: 실제 번역은 외부 주입.
  return { text, confidence: 0.5 }
}

export class CrossLingualAIBridge {
  private readonly glossary: GlossaryEntry[]
  private readonly translator: (
    text: string,
    to: Lang,
  ) => Promise<{ text: string; confidence: number }>
  private readonly auditLog: BridgeAuditEntry[] = []

  constructor(options: BridgeOptions = {}) {
    this.glossary = options.glossary ?? DEFAULT_GLOSSARY
    this.translator = options.translator ?? defaultTranslator
  }

  getAuditLog(): readonly BridgeAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: BridgeAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R117.1: 언어 감지.
   */
  detectLang(text: string): Lang {
    if (text.length === 0) return 'en'
    const total = text.length
    let hangul = 0
    let kana = 0
    let cjk = 0
    for (let i = 0; i < total; i++) {
      const code = text.charCodeAt(i)
      if (code >= 0xac00 && code <= 0xd7af) hangul++
      else if (code >= 0x3040 && code <= 0x30ff) kana++
      else if (code >= 0x4e00 && code <= 0x9fff) cjk++
    }
    let lang: Lang = 'en'
    if (hangul / total > 0.1) lang = 'ko'
    else if (kana > 0) lang = 'ja'
    else if (cjk > 0) lang = 'zh'

    this.audit('detectLang', { lang, hangul, kana, cjk })
    return lang
  }

  /**
   * FR-R117.7: PII 마스킹.
   */
  private maskPII(text: string): { text: string; masked: number } {
    let result = text
    let masked = 0
    for (const { pattern, replacement } of PII_PATTERNS) {
      const matches = result.match(pattern)
      if (matches) {
        masked += matches.length
        result = result.replace(pattern, replacement)
      }
    }
    if (masked > 0) this.audit('piiMasked', { count: masked })
    return { text: result, masked }
  }

  /**
   * FR-R117.3: 용어 사전 후처리.
   */
  private applyGlossary(text: string, targetLang: Lang): {
    text: string
    applied: number
  } {
    if (targetLang === 'ko') return { text, applied: 0 }
    let result = text
    let applied = 0
    for (const entry of this.glossary) {
      const replacement = entry[targetLang]
      if (!replacement) continue
      if (result.includes(entry.ko)) {
        const count = (result.match(new RegExp(escapeRegex(entry.ko), 'g')) ?? [])
          .length
        result = result.split(entry.ko).join(replacement)
        applied += count
      }
    }
    if (applied > 0) this.audit('glossaryApplied', { applied, targetLang })
    return { text: result, applied }
  }

  /**
   * FR-R117.2~5: 번역 실행.
   */
  async translate(request: TranslateRequest): Promise<TranslateResult> {
    // FR-R117.6: 등급 guard
    if (request.grade === DataGrade.C || request.grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade: request.grade })
      throw new Error(
        `BLOCKED: ${request.grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`,
      )
    }

    const sourceLang = this.detectLang(request.text)
    const { text: masked, masked: piiMasked } = this.maskPII(request.text)

    const translated = await this.translator(masked, request.targetLang)
    const { text: finalText, applied } = this.applyGlossary(
      translated.text,
      request.targetLang,
    )

    const result: TranslateResult = {
      sourceLang,
      targetLang: request.targetLang,
      text: finalText,
      confidence: Math.min(1, translated.confidence + applied * 0.01),
      glossaryApplied: applied,
      piiMasked,
    }

    if (request.dualText) {
      result.original = request.text
    }

    this.audit('translate', {
      sourceLang,
      targetLang: request.targetLang,
      glossaryApplied: applied,
      piiMasked,
    })

    return result
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
