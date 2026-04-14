// Design Ref: §설계결정 — AI기반 멀티모달 공공 검색 v2
// Plan SC: FR-R626.1~5

interface SearchIndex { indexId: string; name: string; modality: 'text' | 'image' | 'document' }
interface SearchResult { docId: string; score: number; modality: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class MultimodalPublicSearchV2 {
  private indices = new Map<string, SearchIndex>()
  private documents = new Map<string, { indexId: string; content: string; score: number }[]>()
  private auditLog: AuditEntry[] = []

  registerIndex(indexId: string, name: string, modality: 'text' | 'image' | 'document'): void {
    this.indices.set(indexId, { indexId, name, modality })
    this.documents.set(indexId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_INDEX', details: { indexId, name, modality } })
  }

  indexDocument(indexId: string, docId: string, content: string, relevanceScore: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const docs = this.documents.get(indexId) ?? []
    docs.push({ indexId: docId, content, score: relevanceScore })
    this.documents.set(indexId, docs)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'INDEX_DOCUMENT', details: { indexId, docId, relevanceScore } })
  }

  search(indexId: string, limit: number): SearchResult[] {
    const index = this.indices.get(indexId)
    const docs = this.documents.get(indexId) ?? []
    return docs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(d => ({ docId: d.indexId, score: d.score, modality: index?.modality ?? 'text' }))
  }

  getDocumentCount(indexId: string): number {
    return (this.documents.get(indexId) ?? []).length
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
