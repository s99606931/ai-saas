// Design Ref: §R257 — 다국어 자연어 처리 파이프라인
// Plan SC: SVC-AI-ADV-R257-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Language = 'ko' | 'zh' | 'en' | 'ru' | 'ar' | 'unknown'

export interface IntentDefinition {
  intent: string
  language: Language
  keywords: string[]
}

export interface LanguageDetection {
  language: Language
  confidence: number     // 0~1
  distribution: Record<Language, number>
}

export interface IntentResult {
  intent: string
  score: number
  matchedKeywords: string[]
}

export interface ProcessRequest {
  requestId: string
  citizenId: string
  text: string
  grade?: DataGrade
}

export interface PipelineResult {
  requestId: string
  language: LanguageDetection
  normalized: string
  keywords: string[]
  intent: IntentResult | null
}

interface AuditEntry {
  timestamp: string
  action: string
  citizenIdMasked: string
  detail: Record<string, unknown>
}

const MAX_TEXT_LENGTH = 10_000

export class MultilingualNLPPipeline {
  private intents: IntentDefinition[] = []
  private stopwords = new Map<Language, Set<string>>()
  private auditLog: AuditEntry[] = []

  constructor() {
    // 기본 불용어
    this.registerStopwords('ko', ['은', '는', '이', '가', '을', '를', '의', '에', '와', '과'])
    this.registerStopwords('en', ['the', 'is', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on'])
  }

  registerIntent(intent: IntentDefinition): void {
    if (intent.keywords.length === 0) {
      throw new Error('intent.keywords는 1개 이상이어야 합니다')
    }
    this.intents.push(intent)
  }

  registerStopwords(language: Language, words: string[]): void {
    this.stopwords.set(language, new Set(words))
  }

  detectLanguage(text: string): LanguageDetection {
    if (text.length === 0) {
      return { language: 'unknown', confidence: 0, distribution: this.emptyDist() }
    }
    const counts: Record<Language, number> = this.emptyDist()
    let total = 0
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0
      if ((code >= 0xac00 && code <= 0xd7af) || (code >= 0x3130 && code <= 0x318f)) {
        counts.ko++
        total++
      } else if (code >= 0x4e00 && code <= 0x9fff) {
        counts.zh++
        total++
      } else if (code >= 0x0400 && code <= 0x04ff) {
        counts.ru++
        total++
      } else if (code >= 0x0600 && code <= 0x06ff) {
        counts.ar++
        total++
      } else if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a)) {
        counts.en++
        total++
      }
    }
    if (total === 0) {
      return { language: 'unknown', confidence: 0, distribution: counts }
    }
    const distribution: Record<Language, number> = this.emptyDist()
    for (const lang of Object.keys(counts) as Language[]) {
      distribution[lang] = Number(((counts[lang] ?? 0) / total).toFixed(4))
    }
    let best: Language = 'unknown'
    let bestVal = 0
    const order: Language[] = ['en', 'ko', 'zh', 'ru', 'ar']
    for (const lang of order) {
      const v = distribution[lang] ?? 0
      if (v > bestVal) {
        bestVal = v
        best = lang
      }
    }
    return { language: best, confidence: bestVal, distribution }
  }

  normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  extractKeywords(text: string, topN = 5): string[] {
    const detection = this.detectLanguage(text)
    const normalized = this.normalize(text)
    const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2)
    const stopSet = this.stopwords.get(detection.language) ?? new Set<string>()
    const filtered = tokens.filter((t) => !stopSet.has(t))
    const freq = new Map<string, number>()
    for (const token of filtered) {
      freq.set(token, (freq.get(token) ?? 0) + 1)
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word)
  }

  classifyIntent(text: string): IntentResult | null {
    const detection = this.detectLanguage(text)
    const normalized = this.normalize(text)
    const candidates = this.intents.filter(
      (i) => i.language === detection.language || i.language === 'unknown'
    )
    let best: IntentResult | null = null
    for (const intent of candidates) {
      const matched = intent.keywords.filter((kw) => normalized.includes(kw.toLowerCase()))
      if (matched.length === 0) continue
      const score = matched.length / intent.keywords.length
      if (!best || score > best.score) {
        best = { intent: intent.intent, score: Number(score.toFixed(4)), matchedKeywords: matched }
      }
    }
    return best
  }

  process(request: ProcessRequest): PipelineResult {
    if (request.grade === 'C' || request.grade === 'S') {
      throw new Error(`BLOCKED: ${request.grade}등급 민원은 AI 처리 금지 (N2SF N-05)`)
    }
    if (request.grade !== 'O') {
      throw new Error('민원은 O등급만 허용됩니다')
    }
    if (request.text.length > MAX_TEXT_LENGTH) {
      throw new Error(`텍스트 길이는 ${MAX_TEXT_LENGTH}자 이하여야 합니다`)
    }

    const language = this.detectLanguage(request.text)
    const normalized = this.normalize(request.text)
    const keywords = this.extractKeywords(request.text)
    const intent = this.classifyIntent(request.text)

    this.appendAudit('pipeline.process', this.mask(request.citizenId), {
      requestId: request.requestId,
      language: language.language,
      intent: intent?.intent ?? null,
    })

    return {
      requestId: request.requestId,
      language,
      normalized,
      keywords,
      intent,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private emptyDist(): Record<Language, number> {
    return { ko: 0, zh: 0, en: 0, ru: 0, ar: 0, unknown: 0 }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, citizenIdMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      citizenIdMasked,
      detail,
    })
  }
}
