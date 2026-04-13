// Design Ref: §R373 — AI기반 공공기관 지식 베이스 큐레이션
// Plan SC: SVC-AI-ADV-R373-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ContentType = 'FAQ' | 'REGULATION' | 'GUIDE' | 'TEMPLATE' | 'PROCEDURE'
export type CurationStatus = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'OUTDATED'

export interface KnowledgeArticle {
  articleId: string
  title: string
  content: string
  contentType: ContentType
  grade: DataGrade
  tags: string[]
  publishedAt: string
  updatedAt: string
  viewCount: number
}

export interface CurationResult {
  articleId: string
  status: CurationStatus
  qualityScore: number  // 0..100
  issues: string[]
  suggestedTags: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  articleId: string
  detail: Record<string, unknown>
}

const TAG_KEYWORDS: Record<string, string[]> = {
  '민원': ['민원', '신청', '처리', '접수'],
  '보안': ['보안', '암호화', 'CSAP', 'N2SF', '인증'],
  '데이터': ['데이터', '정보', 'DB', '저장'],
  '행정': ['행정', '공문', '결재', '기안'],
  '법규': ['법', '시행령', '고시', '규정', '지침'],
}

export class PublicKnowledgeCuratorAI {
  private articles = new Map<string, KnowledgeArticle>()
  private auditLog: AuditEntry[] = []

  ingest(article: KnowledgeArticle): void {
    // N2SF C/S 등급 차단
    if (article.grade === 'C' || article.grade === 'S') {
      throw new Error(`BLOCKED: ${article.grade}등급 지식 문서는 AI 큐레이션 금지 (N2SF N-05)`)
    }
    this.articles.set(article.articleId, article)
    this.appendAudit('article.ingest', article.articleId, { contentType: article.contentType })
  }

  curate(articleId: string): CurationResult {
    const article = this.articles.get(articleId)
    if (!article) throw new Error(`Unknown article: ${articleId}`)

    const issues: string[] = []
    let qualityScore = 60

    // 콘텐츠 길이 검사
    if (article.content.length < 50) {
      issues.push('콘텐츠가 너무 짧습니다 (50자 미만)')
      qualityScore -= 20
    } else if (article.content.length >= 200) {
      qualityScore += 10
    }

    // 제목 검사
    if (article.title.length < 5) {
      issues.push('제목이 너무 짧습니다 (5자 미만)')
      qualityScore -= 10
    } else {
      qualityScore += 5
    }

    // 태그 검사
    if (article.tags.length === 0) {
      issues.push('태그가 없습니다 — 검색 가능성 저하')
      qualityScore -= 10
    } else if (article.tags.length >= 3) {
      qualityScore += 10
    }

    // 최신성 검사 (1년 이상 미업데이트)
    const updatedAt = new Date(article.updatedAt)
    const now = new Date()
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUpdate > 365) {
      issues.push(`${Math.floor(daysSinceUpdate)}일 미업데이트 — 내용 재검토 필요`)
      qualityScore -= 15
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore))

    // 상태 결정 (OUTDATED는 REJECTED보다 우선 — 내용 갱신 시 활성화 가능)
    const status: CurationStatus =
      qualityScore >= 70 && issues.length === 0 ? 'APPROVED'
        : issues.some((i) => i.includes('미업데이트')) ? 'OUTDATED'
        : qualityScore < 40 ? 'REJECTED'
        : 'PENDING_REVIEW'

    // 태그 자동 제안
    const suggestedTags: string[] = []
    const combinedText = `${article.title} ${article.content}`.toLowerCase()
    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
      if (!article.tags.includes(tag) && keywords.some((kw) => combinedText.includes(kw))) {
        suggestedTags.push(tag)
      }
    }

    this.appendAudit('article.curate', articleId, { status, qualityScore, issues: issues.length })

    return { articleId, status, qualityScore, issues, suggestedTags }
  }

  search(query: string): KnowledgeArticle[] {
    const tokens = query.toLowerCase().split(/\s+/)
    const results: Array<{ article: KnowledgeArticle; score: number }> = []

    for (const article of this.articles.values()) {
      const text = `${article.title} ${article.content} ${article.tags.join(' ')}`.toLowerCase()
      const score = tokens.filter((t) => text.includes(t)).length
      if (score > 0) results.push({ article, score })
    }

    return results.sort((a, b) => b.score - a.score).map((r) => r.article)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, articleId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, articleId, detail })
  }
}
