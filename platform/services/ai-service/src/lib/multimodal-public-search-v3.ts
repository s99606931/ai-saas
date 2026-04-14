// Design Ref: SVC-AI-ADV-R626 — AI기반 멀티모달 공공 검색 v2 (impl v3)
// Plan SC: FR-R626.1~5
import { createHash } from 'crypto'

type Modality = 'TEXT' | 'IMAGE' | 'AUDIO' | 'PDF'

interface SearchDocument {
  docId: string
  title: string
  text: string
  modalities: Modality[]
  tags: string[]
}

interface SearchQuery {
  text?: string
  tags?: string[]
  modalities?: Modality[]
  userId: string
}

interface SearchResult {
  docId: string
  score: number
  matchedModalities: Modality[]
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class MultimodalPublicSearchV3 {
  private docs = new Map<string, SearchDocument>()
  private auditLog: AuditEntry[] = []

  indexDocument(doc: SearchDocument, dataGrade?: 'C' | 'S' | 'O'): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    this.docs.set(doc.docId, {
      ...doc,
      modalities: [...doc.modalities],
      tags: [...doc.tags],
    })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'INDEX_DOCUMENT',
      details: { docId: doc.docId, modalityCount: doc.modalities.length },
    })
  }

  search(query: SearchQuery, dataGrade?: 'C' | 'S' | 'O'): SearchResult[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const results: SearchResult[] = []
    for (const doc of this.docs.values()) {
      let score = 0
      const matchedModalities: Modality[] = []

      if (query.text) {
        const q = query.text.toLowerCase()
        if (doc.title.toLowerCase().includes(q)) score += 5
        if (doc.text.toLowerCase().includes(q)) score += 2
      }
      if (query.tags) {
        const hits = query.tags.filter((t) => doc.tags.includes(t))
        score += hits.length * 3
      }
      if (query.modalities) {
        for (const m of query.modalities) {
          if (doc.modalities.includes(m)) {
            score += 1
            matchedModalities.push(m)
          }
        }
      }

      if (score > 0) {
        results.push({ docId: doc.docId, score, matchedModalities })
      }
    }
    results.sort((a, b) => b.score - a.score)

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SEARCH',
      actor: maskPII(query.userId),
      details: { resultCount: results.length },
    })
    return results
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
