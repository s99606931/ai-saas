// Design Ref: §R190 — AI기반 멀티모달 공공 서비스 검색
// Plan SC: SVC-AI-ADV-R190-SC01

export type ModalityType = 'TEXT' | 'IMAGE' | 'DOCUMENT'
export type DataGrade = 'C' | 'S' | 'O'

export interface PublicServiceDoc {
  docId: string
  title: string
  content: string
  category: string
  tags: string[]
  modality: ModalityType
  grade: DataGrade
}

export interface SearchQuery {
  queryId: string
  text: string
  modalities?: ModalityType[]
  category?: string
  grade?: DataGrade
}

export interface SearchResult {
  queryId: string
  hits: Array<{ docId: string; title: string; score: number; modality: ModalityType }>
  totalHits: number
}

interface AuditEntry {
  timestamp: string
  action: string
  queryId: string
  detail: Record<string, unknown>
}

export class MultimodalPublicSearch {
  private index = new Map<string, PublicServiceDoc>()
  private auditLog: AuditEntry[] = []

  indexDocument(doc: PublicServiceDoc): void {
    // N2SF: C/S 등급 문서는 색인 금지
    if (doc.grade === 'C' || doc.grade === 'S') {
      throw new Error(`BLOCKED: ${doc.grade}등급 문서는 공개 검색 색인 금지 (N2SF N-05)`)
    }
    this.index.set(doc.docId, doc)
    this.appendAudit('index.add', doc.docId, { title: doc.title })
  }

  search(query: SearchQuery): SearchResult {
    this.appendAudit('search.start', query.queryId, { text: query.text })

    const tokens = query.text.toLowerCase().split(/\s+/).filter((t) => t.length > 0)

    const filtered = Array.from(this.index.values()).filter((doc) => {
      if (query.modalities && query.modalities.length > 0 && !query.modalities.includes(doc.modality)) return false
      if (query.category && doc.category !== query.category) return false
      if (query.grade && doc.grade !== query.grade) return false
      return true
    })

    const scored = filtered.map((doc) => {
      const searchable = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase()
      const matchCount = tokens.filter((t) => searchable.includes(t)).length
      const score = tokens.length > 0 ? matchCount / tokens.length : 0
      return { docId: doc.docId, title: doc.title, score, modality: doc.modality }
    })

    const hits = scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score)

    this.appendAudit('search.complete', query.queryId, { totalHits: hits.length })
    return { queryId: query.queryId, hits, totalHits: hits.length }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, queryId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, queryId, detail })
  }
}
