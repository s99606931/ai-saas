// Design Ref: §R273 — 지능형 문서 검색 엔진
// Plan SC: SVC-AI-ADV-R273-SC01

export type DataGrade = 'C' | 'S' | 'O'

export interface Document {
  docId: string
  title: string
  body: string
  tags: string[]
}

export interface SearchResult {
  docId: string
  title: string
  score: number
  matchedTerms: string[]
}

export interface SearchOptions {
  topN?: number
  tags?: string[]
}

interface IndexedDoc {
  docId: string
  title: string
  tags: Set<string>
  termFrequency: Map<string, number>
  length: number
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

const STOPWORDS = new Set([
  '그리고',
  '그러나',
  '하지만',
  '이',
  '그',
  '저',
  '것',
  '수',
  '등',
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'is',
  'in',
  'on',
])

export class IntelligentDocSearch {
  private docs = new Map<string, IndexedDoc>()
  private auditLog: AuditEntry[] = []

  indexDocument(doc: Document, grade: DataGrade, caller: string): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 문서 인덱싱 금지 (N2SF N-05)`)
    }
    if (!doc.docId) throw new Error('docId 필수')
    if (!doc.title) throw new Error('title 필수')
    if (this.docs.has(doc.docId)) {
      throw new Error(`중복 docId: ${doc.docId}`)
    }

    const text = `${doc.title} ${doc.body}`
    const tokens = this.tokenize(text)
    const tf = new Map<string, number>()
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1)
    }

    this.docs.set(doc.docId, {
      docId: doc.docId,
      title: doc.title,
      tags: new Set(doc.tags),
      termFrequency: tf,
      length: tokens.length,
    })

    this.appendAudit('doc.index', this.mask(caller), {
      docId: doc.docId,
      tokenCount: tokens.length,
    })
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!query.trim()) {
      throw new Error('query 필수')
    }
    const topN = options.topN ?? 10
    if (topN <= 0) throw new Error('topN은 양수여야 합니다')

    const queryTerms = this.tokenize(query)
    if (queryTerms.length === 0) return []

    const totalDocs = this.docs.size
    if (totalDocs === 0) return []

    // IDF 계산
    const idf = new Map<string, number>()
    for (const term of queryTerms) {
      let df = 0
      for (const doc of this.docs.values()) {
        if (doc.termFrequency.has(term)) df++
      }
      if (df === 0) {
        idf.set(term, 0)
      } else {
        idf.set(term, Math.log(totalDocs / df) + 1)
      }
    }

    const results: SearchResult[] = []
    for (const doc of this.docs.values()) {
      // 태그 필터
      if (options.tags && options.tags.length > 0) {
        const hasTag = options.tags.some((t) => doc.tags.has(t))
        if (!hasTag) continue
      }

      let score = 0
      const matched: string[] = []
      for (const term of queryTerms) {
        const tf = doc.termFrequency.get(term) ?? 0
        if (tf === 0) continue
        const tfNorm = tf / Math.max(1, doc.length)
        const idfVal = idf.get(term) ?? 0
        score += tfNorm * idfVal
        matched.push(term)
      }

      // 태그 매칭 시 가중
      if (options.tags) {
        const matchedTagCount = options.tags.filter((t) => doc.tags.has(t)).length
        if (matchedTagCount > 0) score *= 1.5
      }

      if (score > 0) {
        results.push({
          docId: doc.docId,
          title: doc.title,
          score: Math.round(score * 10000) / 10000,
          matchedTerms: matched,
        })
      }
    }

    results.sort((a, b) => b.score - a.score)

    this.appendAudit('search', 'SYSTEM', {
      query: query.slice(0, 50),
      resultCount: results.length,
    })
    return results.slice(0, topN)
  }

  deleteDocument(docId: string, caller: string): void {
    if (!this.docs.has(docId)) {
      throw new Error(`docId 없음: ${docId}`)
    }
    this.docs.delete(docId)
    this.appendAudit('doc.delete', this.mask(caller), { docId })
  }

  getDocCount(): number {
    return this.docs.size
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private tokenize(text: string): string[] {
    const normalized = text.toLowerCase()
    const tokens = normalized.match(/[a-z0-9\uac00-\ud7af]+/g) ?? []
    return tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t))
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
