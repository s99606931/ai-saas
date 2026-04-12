// Design Ref: §R231 — AI기반 공공 데이터 자동 카탈로그화
// Plan SC: SVC-AI-ADV-R231-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type DataFormat = 'CSV' | 'JSON' | 'XML' | 'PDF' | 'EXCEL' | 'API'

export interface RawDataset {
  datasetId: string
  name: string
  description: string
  provider: string
  format: DataFormat
  grade: DataGrade
  tags: string[]
  sampleFields: string[]
  updateFrequency: 'REALTIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
}

export interface CatalogEntry {
  datasetId: string
  name: string
  description: string
  provider: string
  format: DataFormat
  tags: string[]
  inferredCategory: string
  qualityScore: number   // 0~100
  openDataEligible: boolean
  catalogedAt: string
}

export interface CatalogSearchResult {
  datasetId: string
  name: string
  inferredCategory: string
  relevanceScore: number
  openDataEligible: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  datasetId: string
  detail: Record<string, unknown>
}

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: '교통', keywords: ['교통', '도로', '버스', '지하철', '주차', 'traffic', 'transport'] },
  { category: '환경', keywords: ['환경', '대기', '수질', '미세먼지', '폐기물', 'environment'] },
  { category: '복지', keywords: ['복지', '사회', '의료', '건강', '장애', '노인', 'welfare'] },
  { category: '행정', keywords: ['행정', '민원', '공공', '정부', '지자체', 'government'] },
  { category: '경제', keywords: ['경제', '예산', '재정', '세금', '산업', 'economy', 'budget'] },
]

export class PublicDataCatalogAI {
  private catalog = new Map<string, CatalogEntry>()
  private auditLog: AuditEntry[] = []

  catalog_dataset(dataset: RawDataset): CatalogEntry {
    // N2SF: C/S 등급 데이터 공개 카탈로그 금지
    if (dataset.grade === 'C' || dataset.grade === 'S') {
      throw new Error(`BLOCKED: ${dataset.grade}등급 데이터는 공개 카탈로그 등록 금지 (N2SF N-05)`)
    }

    const inferredCategory = this.inferCategory(dataset)
    const qualityScore = this.computeQualityScore(dataset)
    const openDataEligible = dataset.grade === 'O' && qualityScore >= 60

    const entry: CatalogEntry = {
      datasetId: dataset.datasetId,
      name: dataset.name,
      description: dataset.description,
      provider: dataset.provider,
      format: dataset.format,
      tags: dataset.tags,
      inferredCategory,
      qualityScore,
      openDataEligible,
      catalogedAt: new Date().toISOString(),
    }

    this.catalog.set(dataset.datasetId, entry)
    this.appendAudit('dataset.catalog', dataset.datasetId, { category: inferredCategory, qualityScore })

    return { ...entry }
  }

  search(query: string): CatalogSearchResult[] {
    const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
    const results: CatalogSearchResult[] = []

    for (const [, entry] of this.catalog) {
      const searchable = `${entry.name} ${entry.description} ${entry.tags.join(' ')} ${entry.inferredCategory}`.toLowerCase()
      const matchCount = tokens.filter((t) => searchable.includes(t)).length
      const relevanceScore = tokens.length > 0 ? matchCount / tokens.length : 0
      if (relevanceScore > 0) {
        results.push({ datasetId: entry.datasetId, name: entry.name, inferredCategory: entry.inferredCategory, relevanceScore, openDataEligible: entry.openDataEligible })
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private inferCategory(dataset: RawDataset): string {
    const text = `${dataset.name} ${dataset.description} ${dataset.tags.join(' ')}`.toLowerCase()
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      if (keywords.some((k) => text.includes(k))) return category
    }
    return '기타'
  }

  private computeQualityScore(dataset: RawDataset): number {
    let score = 60
    if (dataset.description.length >= 50) score += 10
    if (dataset.tags.length >= 3) score += 10
    if (dataset.sampleFields.length >= 5) score += 10
    if (dataset.updateFrequency === 'REALTIME' || dataset.updateFrequency === 'DAILY') score += 10
    return Math.min(100, score)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, datasetId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, datasetId, detail })
  }
}
