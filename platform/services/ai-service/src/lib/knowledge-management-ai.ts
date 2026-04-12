/**
 * AI 기반 지식 관리 자동화 — SVC-AI-ADV-R180
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R180/SVC-AI-ADV-R180.design.md
 * Plan SC: FR-R180.1 ~ FR-R180.5
 *
 * 지식 문서 등록 + 중복 탐지 + 검색 + 통계.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface KnowledgeDoc {
  id: string
  title: string
  content: string
  category: string
  keywords: string[]
}

export interface DuplicateGroup {
  docIds: string[]
  similarity: number
}

export interface SearchResult {
  doc: KnowledgeDoc
  score: number
}

export interface CategoryStats {
  category: string
  count: number
  keywords: string[]
}

export interface KMAuditEntry {
  action: 'documentRegistered' | 'duplicatesFound' | 'searched' | 'statsGenerated'
  timestamp: number
  details: Record<string, unknown>
}

export class KnowledgeManagementAI {
  private readonly documents = new Map<string, KnowledgeDoc>()
  private readonly auditLog: KMAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 지식 관리 AI 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R180.1 */
  registerDocument(doc: KnowledgeDoc): void {
    if (!doc.id.trim()) throw new Error('document id must not be empty')
    const masked: KnowledgeDoc = {
      ...doc,
      content: this.maskPII(doc.content),
      keywords: [...doc.keywords],
    }
    this.documents.set(doc.id, masked)
    this.audit('documentRegistered', { id: doc.id, category: doc.category })
  }

  /** FR-R180.2 */
  findDuplicates(threshold = 0.6): DuplicateGroup[] {
    const docs = [...this.documents.values()]
    const groups: DuplicateGroup[] = []
    const matched = new Set<string>()

    for (let i = 0; i < docs.length; i++) {
      if (matched.has(docs[i]!.id)) continue
      const group: string[] = [docs[i]!.id]
      let maxSim = 0

      for (let j = i + 1; j < docs.length; j++) {
        if (matched.has(docs[j]!.id)) continue
        const sim = this.jaccard(
          new Set(docs[i]!.keywords.map((k) => k.toLowerCase())),
          new Set(docs[j]!.keywords.map((k) => k.toLowerCase())),
        )
        if (sim >= threshold) {
          group.push(docs[j]!.id)
          matched.add(docs[j]!.id)
          maxSim = Math.max(maxSim, sim)
        }
      }

      if (group.length > 1) {
        matched.add(docs[i]!.id)
        groups.push({ docIds: group, similarity: maxSim })
      }
    }

    this.audit('duplicatesFound', { groups: groups.length, threshold })
    return groups
  }

  /** FR-R180.3 */
  search(query: string): SearchResult[] {
    const tokens = this.tokenize(query.toLowerCase())
    const results: SearchResult[] = []

    for (const doc of this.documents.values()) {
      const titleTokens = new Set(this.tokenize(doc.title.toLowerCase()))
      const keywordSet = new Set(doc.keywords.map((k) => k.toLowerCase()))
      const contentTokens = new Set(this.tokenize(doc.content.toLowerCase()))

      let score = 0
      for (const token of tokens) {
        if (keywordSet.has(token)) score += 3
        if (titleTokens.has(token)) score += 2
        if (contentTokens.has(token)) score += 1
      }

      if (score > 0) results.push({ doc, score })
    }

    results.sort((a, b) => b.score - a.score)
    this.audit('searched', { query: query.slice(0, 50), results: results.length })
    return results
  }

  /** FR-R180.4 */
  getCategoryStats(): CategoryStats[] {
    const statsMap = new Map<string, { count: number; keywords: Set<string> }>()

    for (const doc of this.documents.values()) {
      if (!statsMap.has(doc.category)) {
        statsMap.set(doc.category, { count: 0, keywords: new Set() })
      }
      const entry = statsMap.get(doc.category)!
      entry.count++
      for (const kw of doc.keywords) entry.keywords.add(kw)
    }

    const stats: CategoryStats[] = [...statsMap.entries()].map(([category, data]) => ({
      category,
      count: data.count,
      keywords: [...data.keywords],
    }))

    this.audit('statsGenerated', { categories: stats.length })
    return stats
  }

  /** FR-R180.5 */
  getAuditLog(): readonly KMAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0
    let inter = 0
    for (const k of a) if (b.has(k)) inter++
    const union = a.size + b.size - inter
    return union === 0 ? 0 : inter / union
  }

  private tokenize(text: string): string[] {
    return text.split(/[\s,.\-_/]+/).filter((t) => t.length >= 2)
  }

  private maskPII(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{6}-\d{7}\b/g, '[RRN]')
      .replace(/\b010-\d{4}-\d{4}\b/g, '[PHONE]')
  }

  private audit(action: KMAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
