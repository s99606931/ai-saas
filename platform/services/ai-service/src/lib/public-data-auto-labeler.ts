// Design Ref: §R203 — AI기반 공공 데이터 자동 레이블링
// Plan SC: SVC-AI-ADV-R203-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type LabelCategory = 'POLICY' | 'FINANCE' | 'WELFARE' | 'INFRASTRUCTURE' | 'ENVIRONMENT' | 'GENERAL'
export type LabelConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DataItem {
  itemId: string
  title: string
  content: string
  sourceOrganization: string
  grade?: DataGrade
}

export interface LabelResult {
  itemId: string
  category: LabelCategory
  confidence: LabelConfidence
  tags: string[]
  requiresReview: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  detail: Record<string, unknown>
}

const CATEGORY_KEYWORDS: Record<LabelCategory, string[]> = {
  POLICY: ['정책', '규정', '조례', '법령', '제도', '행정'],
  FINANCE: ['예산', '결산', '재정', '지출', '수입', '세금', '보조금'],
  WELFARE: ['복지', '지원', '수당', '급여', '취약계층', '노인', '장애'],
  INFRASTRUCTURE: ['도로', '건물', '교량', '수도', '전기', '인프라'],
  ENVIRONMENT: ['환경', '녹지', '대기', '수질', '폐기물', '에너지'],
  GENERAL: [],
}

function classifyCategory(text: string): { category: LabelCategory; matchCount: number } {
  const lower = text.toLowerCase()
  let bestCategory: LabelCategory = 'GENERAL'
  let bestCount = 0

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [LabelCategory, string[]][]) {
    if (cat === 'GENERAL') continue
    const count = keywords.filter((kw) => lower.includes(kw)).length
    if (count > bestCount) {
      bestCount = count
      bestCategory = cat
    }
  }

  return { category: bestCategory, matchCount: bestCount }
}

function extractTags(text: string, category: LabelCategory): string[] {
  const keywords = CATEGORY_KEYWORDS[category]
  return keywords.filter((kw) => text.includes(kw)).slice(0, 5)
}

export class PublicDataAutoLabeler {
  private auditLog: AuditEntry[] = []

  label(item: DataItem): LabelResult {
    // N2SF: C/S 등급 데이터 AI 처리 차단
    if (item.grade === 'C' || item.grade === 'S') {
      throw new Error(`BLOCKED: ${item.grade}등급 데이터는 자동 레이블링 금지 (N2SF N-05)`)
    }

    const text = `${item.title} ${item.content}`
    const { category, matchCount } = classifyCategory(text)
    const tags = extractTags(text, category)

    const confidence: LabelConfidence =
      matchCount >= 3 ? 'HIGH' :
      matchCount >= 1 ? 'MEDIUM' : 'LOW'

    const requiresReview = confidence === 'LOW' || category === 'GENERAL'

    this.appendAudit('item.label', item.itemId, { category, confidence, requiresReview })

    return { itemId: item.itemId, category, confidence, tags, requiresReview }
  }

  labelBatch(items: DataItem[]): LabelResult[] {
    return items.map((item) => this.label(item))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, itemId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, itemId, detail })
  }
}
