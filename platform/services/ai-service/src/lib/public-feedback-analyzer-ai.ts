// Design Ref: §R350 — AI기반 공공 서비스 피드백 자동 분석
// Plan SC: SC-R350

export interface FeedbackItem {
  feedbackId: string
  serviceId: string
  userId: string
  content: string
  rating: number
  submittedAt: string
}

export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type FeedbackCategory = 'USABILITY' | 'PERFORMANCE' | 'ACCURACY' | 'ACCESSIBILITY' | 'OTHER'

export interface FeedbackAnalysis {
  feedbackId: string
  maskedUserId: string
  sentiment: SentimentLabel
  category: FeedbackCategory
  keyPhrases: string[]
  priorityScore: number
  requiresEscalation: boolean
}

export interface ServiceFeedbackSummary {
  serviceId: string
  totalFeedback: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  averageRating: number
  topIssues: string[]
  escalationCount: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const USABILITY_KEYWORDS = ['어렵', '복잡', '불편', '사용', '인터페이스', '화면']
const PERFORMANCE_KEYWORDS = ['느리', '오래', '빠르', '응답', '속도', '느림']
const ACCURACY_KEYWORDS = ['오류', '잘못', '틀리', '정확', '오타', '데이터']
const ACCESSIBILITY_KEYWORDS = ['장애', '접근', '글씨', '크기', '화면낭독']

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

function detectCategory(content: string): FeedbackCategory {
  if (PERFORMANCE_KEYWORDS.some((k) => content.includes(k))) return 'PERFORMANCE'
  if (ACCURACY_KEYWORDS.some((k) => content.includes(k))) return 'ACCURACY'
  if (ACCESSIBILITY_KEYWORDS.some((k) => content.includes(k))) return 'ACCESSIBILITY'
  if (USABILITY_KEYWORDS.some((k) => content.includes(k))) return 'USABILITY'
  return 'OTHER'
}

function detectSentiment(rating: number): SentimentLabel {
  if (rating >= 4) return 'POSITIVE'
  if (rating <= 2) return 'NEGATIVE'
  return 'NEUTRAL'
}

export class PublicFeedbackAnalyzerAi {
  private feedbacks = new Map<string, FeedbackItem>()
  private auditLog: AuditEntry[] = []

  submitFeedback(feedback: FeedbackItem): FeedbackAnalysis {
    this.feedbacks.set(feedback.feedbackId, feedback)

    const sentiment = detectSentiment(feedback.rating)
    const category = detectCategory(feedback.content)

    const keyPhrases: string[] = []
    const allKeywords = [...USABILITY_KEYWORDS, ...PERFORMANCE_KEYWORDS, ...ACCURACY_KEYWORDS, ...ACCESSIBILITY_KEYWORDS]
    for (const kw of allKeywords) {
      if (feedback.content.includes(kw) && keyPhrases.length < 5) keyPhrases.push(kw)
    }

    // 우선순위: 부정 + 낮은 평점 → 높음
    const priorityScore = sentiment === 'NEGATIVE' ? Math.max(0, (3 - feedback.rating) * 30) : 0
    const requiresEscalation = priorityScore >= 60 || feedback.rating === 1

    this.auditLog.push({ action: 'feedback.submit', timestamp: new Date().toISOString(), detail: `${feedback.feedbackId}:${sentiment}` })
    return {
      feedbackId: feedback.feedbackId,
      maskedUserId: maskUserId(feedback.userId),
      sentiment,
      category,
      keyPhrases,
      priorityScore,
      requiresEscalation,
    }
  }

  summarize(serviceId: string): ServiceFeedbackSummary {
    const items = Array.from(this.feedbacks.values()).filter((f) => f.serviceId === serviceId)

    const positiveCount = items.filter((f) => f.rating >= 4).length
    const negativeCount = items.filter((f) => f.rating <= 2).length
    const neutralCount = items.length - positiveCount - negativeCount
    const averageRating = items.length > 0 ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0

    const issueCounts = new Map<string, number>()
    for (const item of items) {
      const cat = detectCategory(item.content)
      if (cat !== 'OTHER') issueCounts.set(cat, (issueCounts.get(cat) ?? 0) + 1)
    }
    const topIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    const escalationCount = items.filter((f) => f.rating === 1 || (f.rating <= 2 && (3 - f.rating) * 30 >= 60)).length

    this.auditLog.push({ action: 'feedback.summarize', timestamp: new Date().toISOString(), detail: `${serviceId}:${items.length}` })
    return { serviceId, totalFeedback: items.length, positiveCount, neutralCount, negativeCount, averageRating: Math.round(averageRating * 100) / 100, topIssues, escalationCount }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
