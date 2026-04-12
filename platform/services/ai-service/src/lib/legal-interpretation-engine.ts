/**
 * AI 법령 해석 엔진 — SVC-AI-ADV-R154
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R154/SVC-AI-ADV-R154.design.md
 * Plan SC: FR-R154.1 ~ FR-R154.7
 *
 * 법령 조문 키워드 검색 + 자연어 해석 근거 자동 제시.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface LegalArticle {
  id: string
  lawName: string
  articleNo: string
  content: string
  keywords?: string[]
}

export interface ArticleMatch {
  article: LegalArticle
  score: number
}

export interface InterpretationResult {
  query: string
  maskedQuery: string
  articles: ArticleMatch[]
  interpretation: string
  confidence: number
  timestamp: number
}

export interface LegalAuditEntry {
  action: 'articleRegistered' | 'queried' | 'interpreted'
  timestamp: number
  details: Record<string, unknown>
}

export class LegalInterpretationEngine {
  private readonly articles = new Map<string, LegalArticle & { tokenSet: Set<string> }>()
  private readonly auditLog: LegalAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 법령 해석 엔진 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R154.1 */
  registerArticle(article: LegalArticle): void {
    if (!article.id.trim()) throw new Error('article.id must not be empty')
    if (!article.content.trim()) throw new Error('article.content must not be empty')

    const tokens = this.tokenize(article.content + ' ' + (article.keywords ?? []).join(' '))
    this.articles.set(article.id, { ...article, tokenSet: tokens })

    this.audit('articleRegistered', { id: article.id, lawName: article.lawName })
  }

  /** FR-R154.2 ~ FR-R154.4 */
  query(text: string): InterpretationResult {
    const maskedQuery = this.maskPII(text)
    const queryTokens = this.tokenize(maskedQuery)

    this.audit('queried', { queryLength: text.length })

    const matches: ArticleMatch[] = []
    for (const stored of this.articles.values()) {
      const score = this.jaccard(queryTokens, stored.tokenSet)
      if (score > 0) {
        matches.push({ article: { ...stored }, score })
      }
    }
    matches.sort((a, b) => b.score - a.score)
    const top = matches.slice(0, 3)

    const interpretation = this.buildInterpretation(maskedQuery, top)
    const confidence = top.length > 0
      ? top.reduce((s, m) => s + m.score, 0) / top.length
      : 0

    const result: InterpretationResult = {
      query: maskedQuery,
      maskedQuery,
      articles: top,
      interpretation,
      confidence,
      timestamp: Date.now(),
    }

    this.audit('interpreted', { matchCount: top.length, confidence })
    return result
  }

  /** FR-R154.7 */
  getAuditLog(): readonly LegalAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private buildInterpretation(query: string, matches: ArticleMatch[]): string {
    if (matches.length === 0) {
      return `"${query}"에 대한 관련 조문을 찾을 수 없습니다. 전문 법무 담당자에게 문의하십시오.`
    }
    const parts = matches.map((m) => {
      const preview = m.article.content.slice(0, 100)
      return `[${m.article.lawName} 제${m.article.articleNo}조] ${preview}${m.article.content.length > 100 ? '...' : ''} (관련도: ${(m.score * 100).toFixed(0)}%)`
    })
    return `질의 "${query}"에 관련된 조문:\n` + parts.join('\n') +
      '\n\n본 해석은 참고용입니다. 공식 유권해석은 관련 기관에 문의하십시오.'
  }

  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>()
    // 한국어 2-gram
    const korBlocks = text.match(/[\uac00-\ud7af]+/g) ?? []
    for (const block of korBlocks) {
      for (let i = 0; i < block.length - 1; i++) {
        tokens.add(block.slice(i, i + 2))
      }
    }
    // 영어 단어
    const engWords = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
    for (const w of engWords) tokens.add(w)
    return tokens
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0
    let inter = 0
    for (const t of a) if (b.has(t)) inter++
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
  }

  private maskPII(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{6}-\d{7}\b/g, '[RRN]')
      .replace(/\b010-\d{4}-\d{4}\b/g, '[PHONE]')
  }

  private audit(action: LegalAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
