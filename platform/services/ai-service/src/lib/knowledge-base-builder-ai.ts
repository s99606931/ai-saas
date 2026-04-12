// Design Ref: §R209 — AI기반 지식 베이스 자동 구축
// Plan SC: SVC-AI-ADV-R209-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type DocStatus = 'PENDING' | 'INDEXED' | 'FAILED'

export interface KbDocument {
  docId: string
  title: string
  content: string
  tags: string[]
  grade: DataGrade
  source: string
}

export interface KbEntry {
  docId: string
  title: string
  tags: string[]
  status: DocStatus
  wordCount: number
  indexedAt?: string
}

export interface KbSearchResult {
  docId: string
  title: string
  relevanceScore: number
  matchedTags: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  docId: string
  detail: Record<string, unknown>
}

export class KnowledgeBaseBuilderAI {
  private entries = new Map<string, KbEntry>()
  private documents = new Map<string, KbDocument>()
  private auditLog: AuditEntry[] = []

  ingest(doc: KbDocument): KbEntry {
    // N2SF: C/S 등급 문서 색인 차단
    if (doc.grade === 'C' || doc.grade === 'S') {
      throw new Error(`BLOCKED: ${doc.grade}등급 문서는 지식 베이스 색인 금지 (N2SF N-05)`)
    }

    const wordCount = doc.content.split(/\s+/).filter((w) => w.length > 0).length
    const entry: KbEntry = {
      docId: doc.docId,
      title: doc.title,
      tags: doc.tags,
      status: 'INDEXED',
      wordCount,
      indexedAt: new Date().toISOString(),
    }

    this.entries.set(doc.docId, entry)
    this.documents.set(doc.docId, doc)
    this.appendAudit('doc.index', doc.docId, { title: doc.title, wordCount })

    return { ...entry }
  }

  search(query: string, topK = 5): KbSearchResult[] {
    const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
    const results: KbSearchResult[] = []

    for (const [docId, doc] of this.documents) {
      const entry = this.entries.get(docId)
      if (!entry || entry.status !== 'INDEXED') continue

      const contentText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase()
      const matchCount = queryTokens.filter((t) => contentText.includes(t)).length
      const relevanceScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0

      const matchedTags = doc.tags.filter((tag) => queryTokens.some((t) => tag.toLowerCase().includes(t)))

      if (relevanceScore > 0) {
        results.push({ docId, title: doc.title, relevanceScore, matchedTags })
      }
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    return results.slice(0, topK)
  }

  getEntry(docId: string): KbEntry {
    const entry = this.entries.get(docId)
    if (!entry) throw new Error(`Unknown document: ${docId}`)
    return { ...entry }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, docId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, docId, detail })
  }
}
