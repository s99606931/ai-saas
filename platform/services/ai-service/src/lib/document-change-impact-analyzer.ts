/**
 * 문서 변경 영향 분석기 — SVC-AI-ADV-R164
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R164/SVC-AI-ADV-R164.design.md
 * Plan SC: FR-R164.1 ~ FR-R164.5
 *
 * 정책/절차 문서 변경 시 영향받는 하위 문서 자동 탐지 + 심각도 평가.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface PolicyDocument {
  id: string
  title: string
  keywords: string[]
  referencedDocIds: string[]
}

export interface ImpactedDocument {
  id: string
  title: string
  distance: number
  sharedKeywords: string[]
  severity: 'high' | 'medium' | 'low'
}

export interface ChangeImpactReport {
  changedDocId: string
  directImpact: ImpactedDocument[]
  transitiveImpact: ImpactedDocument[]
  totalImpacted: number
  reviewRequired: string[]
  analysisAt: number
}

export interface DCIAAuditEntry {
  action: 'documentRegistered' | 'impactAnalyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class DocumentChangeImpactAnalyzer {
  private readonly documents = new Map<string, PolicyDocument>()
  private readonly auditLog: DCIAAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 문서 변경 영향 분석기 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R164.1 */
  registerDocument(doc: PolicyDocument): void {
    if (!doc.id.trim()) throw new Error('document id must not be empty')
    this.documents.set(doc.id, { ...doc, keywords: [...doc.keywords], referencedDocIds: [...doc.referencedDocIds] })
    this.audit('documentRegistered', { id: doc.id, title: doc.title })
  }

  /** FR-R164.3 ~ FR-R164.4 */
  analyzeImpact(docId: string): ChangeImpactReport {
    if (!this.documents.has(docId)) throw new Error(`unknown document: ${docId}`)

    const changedDoc = this.documents.get(docId)!
    const changedKeywords = new Set(changedDoc.keywords.map((k) => k.toLowerCase()))

    // Build reverse reference graph
    const reverseRefs = new Map<string, Set<string>>()
    for (const [id, doc] of this.documents.entries()) {
      for (const refId of doc.referencedDocIds) {
        if (!reverseRefs.has(refId)) reverseRefs.set(refId, new Set())
        reverseRefs.get(refId)!.add(id)
      }
    }

    // Add keyword-based auto-inferred dependencies (FR-R164.2)
    for (const [id, doc] of this.documents.entries()) {
      if (id === docId) continue
      const docKeywords = new Set(doc.keywords.map((k) => k.toLowerCase()))
      if (this.jaccard(changedKeywords, docKeywords) >= 0.2) {
        if (!reverseRefs.has(docId)) reverseRefs.set(docId, new Set())
        reverseRefs.get(docId)!.add(id)
      }
    }

    // BFS: direct dependents (distance=1)
    const directIds = new Set([...(reverseRefs.get(docId) ?? [])])
    const directImpact: ImpactedDocument[] = []
    for (const id of directIds) {
      const doc = this.documents.get(id)
      if (!doc) continue
      const shared = this.sharedKeywords(changedKeywords, new Set(doc.keywords.map((k) => k.toLowerCase())))
      const severity = this.calcSeverity(1, shared.length)
      directImpact.push({ id, title: doc.title, distance: 1, sharedKeywords: shared, severity })
    }

    // BFS: transitive
    const visited = new Set<string>([docId, ...directIds])
    const queue = [...directIds]
    const transitiveImpact: ImpactedDocument[] = []
    let distance = 2

    while (queue.length > 0) {
      const levelSize = queue.length
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift()!
        for (const id of reverseRefs.get(current) ?? []) {
          if (!visited.has(id)) {
            visited.add(id)
            queue.push(id)
            const doc = this.documents.get(id)
            if (doc) {
              const shared = this.sharedKeywords(changedKeywords, new Set(doc.keywords.map((k) => k.toLowerCase())))
              const severity = this.calcSeverity(distance, shared.length)
              transitiveImpact.push({ id, title: doc.title, distance, sharedKeywords: shared, severity })
            }
          }
        }
      }
      distance++
    }

    const reviewRequired = [...directImpact, ...transitiveImpact]
      .filter((d) => d.severity === 'high')
      .map((d) => d.id)

    const report: ChangeImpactReport = {
      changedDocId: docId,
      directImpact,
      transitiveImpact,
      totalImpacted: directImpact.length + transitiveImpact.length,
      reviewRequired,
      analysisAt: Date.now(),
    }

    this.audit('impactAnalyzed', { docId, total: report.totalImpacted, reviewRequired: reviewRequired.length })
    return report
  }

  /** FR-R164.5 */
  getAuditLog(): readonly DCIAAuditEntry[] {
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

  private sharedKeywords(a: Set<string>, b: Set<string>): string[] {
    return [...a].filter((k) => b.has(k))
  }

  private calcSeverity(distance: number, sharedCount: number): 'high' | 'medium' | 'low' {
    if (distance === 1 && sharedCount >= 3) return 'high'
    if (distance === 1) return 'medium'
    return 'low'
  }

  private audit(action: DCIAAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
