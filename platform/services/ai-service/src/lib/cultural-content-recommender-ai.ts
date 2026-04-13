// Plan SC: SVC-AI-ADV-R639
// Design Ref: §HYBRID_RECO — 협업필터링 + 콘텐츠 기반 하이브리드 추천

type DataGrade = 'O' | 'C' | 'S'
type ContentCategory = 'movie' | 'concert' | 'exhibition' | 'musical' | 'festival' | 'book'

interface CulturalContent {
  contentId: string
  title: string
  category: ContentCategory
  tags: string[]
  rating: number
  region: string
}

interface UserPreference {
  userId: string
  favoriteCategories: ContentCategory[]
  favoriteTags: string[]
  homeRegion: string
  viewedContentIds: string[]
}

interface Recommendation {
  contentId: string
  score: number
  matchedTags: string[]
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export class CulturalContentRecommenderAI {
  private contents = new Map<string, CulturalContent>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  addContent(content: CulturalContent): CulturalContent {
    this.contents.set(content.contentId, content)
    this.log('content.add', `contentId=${content.contentId} category=${content.category}`)
    return content
  }

  recommend(pref: UserPreference, topK = 5, grade: DataGrade = 'O'): Recommendation[] {
    blockClassifiedData(grade)
    const viewed = new Set(pref.viewedContentIds)
    const recs: Recommendation[] = []

    for (const content of this.contents.values()) {
      if (viewed.has(content.contentId)) continue

      let score = 0
      if (pref.favoriteCategories.includes(content.category)) score += 30
      const matchedTags = content.tags.filter((t) => pref.favoriteTags.includes(t))
      score += matchedTags.length * 10
      if (content.region === pref.homeRegion) score += 15
      score += content.rating * 5

      if (score <= 0) continue
      recs.push({ contentId: content.contentId, score: Math.round(score), matchedTags })
    }

    recs.sort((a, b) => b.score - a.score)
    const top = recs.slice(0, topK)
    this.log('recommend.topK', `userId=${pref.userId} count=${top.length}`)
    return top
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
