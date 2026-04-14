// Design Ref: §설계 결정 — 키워드 사전 분류, 감성/우선순위 산출
// Plan SC: SVC-AI-ADV-R611
import { createHash } from 'crypto'

export type DataGrade = 'O' | 'C' | 'S'

export type FeedbackCategory =
  | 'COMPLAINT'
  | 'SUGGESTION'
  | 'PRAISE'
  | 'QUESTION'
  | 'OTHER'

export type Sentiment = 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface FeedbackInput {
  id: string
  authorContact: string
  content: string
}

export interface ClassifiedFeedback {
  id: string
  authorMasked: string
  category: FeedbackCategory
  sentiment: Sentiment
  priority: Priority
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

const CATEGORY_KEYWORDS: Record<FeedbackCategory, string[]> = {
  COMPLAINT: ['불만', '문제', '오류', '실패', '느림'],
  SUGGESTION: ['제안', '개선', '추가', '요청'],
  PRAISE: ['감사', '좋음', '만족', '훌륭'],
  QUESTION: ['?', '문의', '질문', '어떻게'],
  OTHER: [],
}

const NEGATIVE_WORDS = ['불만', '문제', '오류', '실패', '느림', '화남']
const POSITIVE_WORDS = ['감사', '좋음', '만족', '훌륭', '편리']

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class PublicFeedbackClassifierV3 {
  private classified: ClassifiedFeedback[] = []
  private auditLog: AuditEntry[] = []

  classify(input: FeedbackInput, grade: DataGrade = 'O'): ClassifiedFeedback {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!input.id || !input.content) throw new Error('id와 content는 필수')
    const category = this.detectCategory(input.content)
    const sentiment = this.detectSentiment(input.content)
    const priority: Priority =
      sentiment === 'NEGATIVE' && category === 'COMPLAINT'
        ? 'HIGH'
        : category === 'COMPLAINT'
          ? 'MEDIUM'
          : 'LOW'
    const result: ClassifiedFeedback = {
      id: input.id,
      authorMasked: maskPII(input.authorContact),
      category,
      sentiment,
      priority,
    }
    this.classified.push(result)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'feedback.classify',
      details: { id: input.id, category, sentiment, priority },
    })
    return result
  }

  private detectCategory(content: string): FeedbackCategory {
    for (const cat of ['COMPLAINT', 'SUGGESTION', 'PRAISE', 'QUESTION'] as FeedbackCategory[]) {
      if (CATEGORY_KEYWORDS[cat].some((k) => content.includes(k))) return cat
    }
    return 'OTHER'
  }

  private detectSentiment(content: string): Sentiment {
    const neg = NEGATIVE_WORDS.filter((w) => content.includes(w)).length
    const pos = POSITIVE_WORDS.filter((w) => content.includes(w)).length
    if (neg > pos) return 'NEGATIVE'
    if (pos > neg) return 'POSITIVE'
    return 'NEUTRAL'
  }

  getCategoryStats(): Record<FeedbackCategory, number> {
    const stats: Record<FeedbackCategory, number> = {
      COMPLAINT: 0,
      SUGGESTION: 0,
      PRAISE: 0,
      QUESTION: 0,
      OTHER: 0,
    }
    for (const f of this.classified) stats[f.category]++
    return stats
  }

  getHighPriority(): ClassifiedFeedback[] {
    return this.classified.filter((f) => f.priority === 'HIGH')
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
