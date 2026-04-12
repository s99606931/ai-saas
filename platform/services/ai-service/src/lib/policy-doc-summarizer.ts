/**
 * Policy Doc Summarizer — SVC-AI-ADV-R189 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R189/SVC-AI-ADV-R189.design.md
 * Plan SC: FR-R189.1 ~ FR-R189.5
 *
 * 정책 문서 핵심 문장 추출 + 키워드 기반 요약. N2SF N-05.
 */

export type DataGrade = 'C' | 'S' | 'O'

export interface PolicyDoc {
  docId: string
  title: string
  body: string
  category: string
  grade: DataGrade
}

export interface DocSummary {
  docId: string
  title: string
  keywords: string[]
  keySentences: string[]
  summary: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  docId: string
  detail: Record<string, unknown>
}

export class PolicyDocSummarizer {
  private readonly docs = new Map<string, PolicyDoc>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R189.1 + FR-R189.2 — N2SF N-05
  registerDoc(doc: PolicyDoc): void {
    if (doc.grade === 'C' || doc.grade === 'S') {
      throw new Error(`BLOCKED: ${doc.grade}등급 문서 등록 금지 (N2SF N-05)`)
    }
    this.docs.set(doc.docId, { ...doc })
    this.appendAudit('doc.register', doc.docId, { title: doc.title, category: doc.category })
  }

  // Plan SC: FR-R189.3 + FR-R189.4 — Design Ref: §알고리즘
  summarize(docId: string, topN = 3): DocSummary {
    const doc = this.docs.get(docId)
    if (!doc) throw new Error(`Unknown document: ${docId}`)

    const sentences = doc.body.split(/[.!?。\n]+/).map((s) => s.trim()).filter((s) => s.length > 0)
    const tokens = doc.body.split(/[\s,.:;!?()\[\]{}"'""''·\-\/\\]+/).filter((t) => t.length >= 2)

    const freq = new Map<string, number>()
    for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)

    const keywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k)

    // 문장 점수: 포함된 고빈도 토큰 수
    const scoredSentences = sentences.map((s) => {
      const sentTokens = s.split(/\s+/)
      const score = sentTokens.reduce((sum, t) => sum + (freq.get(t) ?? 0), 0)
      return { sentence: s, score }
    })
    const keySentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((s) => s.sentence)

    const summary = sentences.length === 0
      ? '내용 없음'
      : `총 ${sentences.length}개 문장. 주요 키워드: ${keywords.join(', ')}`

    this.appendAudit('doc.summarize', docId, { sentences: sentences.length, keywords: keywords.length })
    return { docId, title: doc.title, keywords, keySentences, summary }
  }

  // Plan SC: FR-R189.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, docId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, docId, detail })
  }
}
