# SVC-AI-ADV-R195 — 법령 변경 영향 추적기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export interface LegalArticle { articleId: string; lawName: string; content: string; effectiveDate: string }
export interface LegalRevision { articleId: string; previousContent: string; newContent: string; revisedAt: string; reason: string }
export interface AffectedSystem { systemId: string; name: string; referencedArticleIds: string[] }
export interface ImpactReport { articleId: string; revision: LegalRevision; affectedSystems: AffectedSystem[]; totalImpacted: number; analysisAt: string }
class LegalChangeImpactTracker {
  registerArticle(article: LegalArticle): void
  registerSystem(system: AffectedSystem): void
  recordRevision(revision: LegalRevision): ImpactReport
  getRevisionHistory(articleId: string): LegalRevision[]
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘
- 영향 탐지: system.referencedArticleIds.includes(articleId) → 영향 시스템
- ImpactReport: 변경된 법령 참조 시스템 전체 목록
