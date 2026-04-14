// Design Ref: §R522 — AI기반 공공 데이터 검색 지능화 v2
// Plan SC: SVC-AI-ADV-R522-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type SearchResultRelevance = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PublicDataset {
  datasetId: string
  title: string
  description: string
  tags: string[]
  category: string
  grade: DataGrade
  downloadCount: number
  lastUpdatedDaysAgo: number
  organization: string
}

export interface SearchQuery {
  queryId: string
  keywords: string[]
  categoryFilter?: string
  maxResults?: number
}

export interface SearchResult {
  datasetId: string
  title: string
  relevance: SearchResultRelevance
  matchScore: number   // 0..100
  matchedKeywords: string[]
  snippet: string
}

export interface SearchResponse {
  queryId: string
  totalFound: number
  results: SearchResult[]
  suggestions: string[]   // 관련 검색어 제안
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  queryId: string
  detail: Record<string, unknown>
}

export class PublicDataSearchIntelligenceV2 {
  private datasets = new Map<string, PublicDataset>()
  private auditLog: AuditEntry[] = []

  registerDataset(dataset: PublicDataset): void {
    // N2SF C/S 등급 차단
    if (dataset.grade === 'C' || dataset.grade === 'S') {
      throw new Error(`BLOCKED: ${dataset.grade}등급 데이터셋은 공개 검색 인덱스 등록 금지 (N2SF N-05)`)
    }
    this.datasets.set(dataset.datasetId, dataset)
    this.appendAudit('dataset.register', 'system', { datasetId: dataset.datasetId, title: dataset.title })
  }

  search(query: SearchQuery): SearchResponse {
    this.appendAudit('search.execute', query.queryId, { keywords: query.keywords, categoryFilter: query.categoryFilter })

    const maxResults = query.maxResults ?? 10
    const allDatasets = Array.from(this.datasets.values())

    // 카테고리 필터 적용
    const filtered = query.categoryFilter
      ? allDatasets.filter((d) => d.category === query.categoryFilter)
      : allDatasets

    // 키워드 매칭 점수 계산
    const scored = filtered.map((dataset) => {
      const text = `${dataset.title} ${dataset.description} ${dataset.tags.join(' ')}`.toLowerCase()
      const matchedKeywords = query.keywords.filter((kw) => text.includes(kw.toLowerCase()))
      const keywordScore = query.keywords.length > 0
        ? (matchedKeywords.length / query.keywords.length) * 60
        : 0
      const popularityScore = Math.min(20, dataset.downloadCount / 100)
      const freshnessScore = dataset.lastUpdatedDaysAgo <= 30 ? 20
        : dataset.lastUpdatedDaysAgo <= 90 ? 10
        : 0

      const matchScore = Math.round(keywordScore + popularityScore + freshnessScore)

      return { dataset, matchScore, matchedKeywords }
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults)

    const results: SearchResult[] = scored.map((item) => ({
      datasetId: item.dataset.datasetId,
      title: item.dataset.title,
      relevance: item.matchScore >= 70 ? 'HIGH' : item.matchScore >= 40 ? 'MEDIUM' : 'LOW',
      matchScore: item.matchScore,
      matchedKeywords: item.matchedKeywords,
      snippet: item.dataset.description.slice(0, 100),
    }))

    // 관련 검색어 제안: 매칭된 데이터셋의 태그에서 수집
    const suggestionsSet = new Set<string>()
    for (const item of scored.slice(0, 3)) {
      item.dataset.tags.forEach((tag) => suggestionsSet.add(tag))
    }
    query.keywords.forEach((kw) => suggestionsSet.delete(kw))
    const suggestions = Array.from(suggestionsSet).slice(0, 5)

    return {
      queryId: query.queryId,
      totalFound: results.length,
      results,
      suggestions,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, queryId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, queryId, detail })
  }
}
