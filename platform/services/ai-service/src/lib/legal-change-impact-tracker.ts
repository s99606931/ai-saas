/**
 * Legal Change Impact Tracker — SVC-AI-ADV-R195 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R195/SVC-AI-ADV-R195.design.md
 * Plan SC: FR-R195.1 ~ FR-R195.5
 *
 * 법령 개정 이력 추적 + 영향 시스템 자동 탐지. CSAP D-06.
 */

export interface LegalArticle {
  articleId: string
  lawName: string
  content: string
  effectiveDate: string
}

export interface LegalRevision {
  articleId: string
  previousContent: string
  newContent: string
  revisedAt: string
  reason: string
}

export interface AffectedSystem {
  systemId: string
  name: string
  referencedArticleIds: string[]
}

export interface ImpactReport {
  articleId: string
  revision: LegalRevision
  affectedSystems: AffectedSystem[]
  totalImpacted: number
  analysisAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  articleId: string
  detail: Record<string, unknown>
}

export class LegalChangeImpactTracker {
  private readonly articles = new Map<string, LegalArticle>()
  private readonly revisions = new Map<string, LegalRevision[]>()
  private readonly systems = new Map<string, AffectedSystem>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R195.1
  registerArticle(article: LegalArticle): void {
    this.articles.set(article.articleId, { ...article })
    this.revisions.set(article.articleId, [])
    this.appendAudit('article.register', article.articleId, { lawName: article.lawName })
  }

  // Plan SC: FR-R195.3
  registerSystem(system: AffectedSystem): void {
    this.systems.set(system.systemId, { ...system, referencedArticleIds: [...system.referencedArticleIds] })
    this.appendAudit('system.register', '', { systemId: system.systemId, refs: system.referencedArticleIds.length })
  }

  // Plan SC: FR-R195.2 + FR-R195.4 — Design Ref: §알고리즘
  recordRevision(revision: LegalRevision): ImpactReport {
    if (!this.articles.has(revision.articleId)) {
      throw new Error(`Unknown article: ${revision.articleId}`)
    }

    const revList = this.revisions.get(revision.articleId) ?? []
    revList.push({ ...revision })
    this.revisions.set(revision.articleId, revList)

    // 영향 시스템 탐지
    const affected = [...this.systems.values()].filter(
      (s) => s.referencedArticleIds.includes(revision.articleId),
    )

    const report: ImpactReport = {
      articleId: revision.articleId,
      revision: { ...revision },
      affectedSystems: affected.map((s) => ({ ...s, referencedArticleIds: [...s.referencedArticleIds] })),
      totalImpacted: affected.length,
      analysisAt: new Date().toISOString(),
    }
    this.appendAudit('revision.record', revision.articleId, { totalImpacted: affected.length })
    return report
  }

  // Plan SC: FR-R195.4
  getRevisionHistory(articleId: string): LegalRevision[] {
    return [...(this.revisions.get(articleId) ?? [])]
  }

  // Plan SC: FR-R195.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, articleId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, articleId, detail })
  }
}
