/**
 * Citizen Feedback Analyzer — SVC-AI-ADV-R163
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R163.design.md
 * Plan SC: FR-R163.1 ~ FR-R163.8
 *
 * 민원 피드백 자동 분석기 — 감성/주제/긴급도 3축 분류.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type Topic =
  | 'welfare'
  | 'tax'
  | 'traffic'
  | 'environment'
  | 'safety'
  | 'other'

export interface Analysis {
  id: number
  text: string
  sentiment: Sentiment
  topic: Topic
  urgency: number
  at: number
}

export interface Trend {
  topic: Topic
  count: number
  avgUrgency: number
}

export interface AnalyzerStats {
  totalAnalyzed: number
  urgentCount: number
  blocked: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface AnalyzerOptions {
  now?: () => number
  urgencyThreshold?: number
}

const POSITIVE_WORDS = ['감사', '좋', '훌륭', '만족', '친절', '빠르']
const NEGATIVE_WORDS = ['불만', '화', '불편', '최악', '느리', '짜증', '실망']
const URGENT_WORDS = ['위험', '긴급', '사고', '즉시', '응급', '피해']

const TOPIC_KEYWORDS: Record<Topic, string[]> = {
  welfare: ['복지', '지원금', '수급', '연금', '보조금'],
  tax: ['세금', '과세', '납부', '체납', '재산세'],
  traffic: ['교통', '신호', '주차', '도로', '버스', '지하철'],
  environment: ['환경', '쓰레기', '공해', '미세먼지', '소음'],
  safety: ['안전', '치안', '범죄', '화재', '재난'],
  other: [],
}

export class CitizenFeedbackAnalyzerR163 {
  private readonly analyses: Analysis[] = []
  private readonly urgentQueue: Analysis[] = []
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly urgencyThreshold: number
  private counter = 0
  private blocked = 0

  constructor(opts: AnalyzerOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.urgencyThreshold = opts.urgencyThreshold ?? 70
  }

  /** FR-R163.1~4: 피드백 분석 */
  analyze(text: string, grade: DataGrade = 'O'): Analysis {
    this.assertGrade(grade)
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('invalid_text')
    }

    const id = ++this.counter
    const sentiment = this.computeSentiment(text)
    const topic = this.computeTopic(text)
    const urgency = this.computeUrgency(text, sentiment)

    const analysis: Analysis = {
      id,
      text,
      sentiment,
      topic,
      urgency,
      at: this.now(),
    }

    this.analyses.push(analysis)
    if (urgency >= this.urgencyThreshold) {
      this.urgentQueue.push(analysis)
      this.audit('urgent_queued', { id, urgency, topic })
    }
    this.audit('analyzed', { id, sentiment, topic, urgency })
    return analysis
  }

  /** FR-R163.5: 주제별 트렌드 */
  getTrend(): Trend[] {
    const byTopic = new Map<Topic, { count: number; sum: number }>()
    for (const a of this.analyses) {
      const entry = byTopic.get(a.topic) ?? { count: 0, sum: 0 }
      entry.count += 1
      entry.sum += a.urgency
      byTopic.set(a.topic, entry)
    }
    const result: Trend[] = []
    for (const [topic, v] of byTopic.entries()) {
      result.push({
        topic,
        count: v.count,
        avgUrgency: v.count > 0 ? v.sum / v.count : 0,
      })
    }
    return result.sort((a, b) => b.count - a.count)
  }

  /** FR-R163.6: 긴급 큐 */
  getUrgentQueue(): Analysis[] {
    return [...this.urgentQueue]
  }

  getStats(): AnalyzerStats {
    return {
      totalAnalyzed: this.analyses.length,
      urgentCount: this.urgentQueue.length,
      blocked: this.blocked,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private computeSentiment(text: string): Sentiment {
    let pos = 0
    let neg = 0
    for (const w of POSITIVE_WORDS) if (text.includes(w)) pos += 1
    for (const w of NEGATIVE_WORDS) if (text.includes(w)) neg += 1
    if (pos > neg) return 'positive'
    if (neg > pos) return 'negative'
    return 'neutral'
  }

  private computeTopic(text: string): Topic {
    let bestTopic: Topic = 'other'
    let bestScore = 0
    for (const topic of Object.keys(TOPIC_KEYWORDS) as Topic[]) {
      if (topic === 'other') continue
      const kws = TOPIC_KEYWORDS[topic]
      let score = 0
      for (const k of kws) if (text.includes(k)) score += 1
      if (score > bestScore) {
        bestScore = score
        bestTopic = topic
      }
    }
    return bestTopic
  }

  private computeUrgency(text: string, sentiment: Sentiment): number {
    let urgentHits = 0
    for (const w of URGENT_WORDS) if (text.includes(w)) urgentHits += 1
    const sentimentFactor = sentiment === 'negative' ? 40 : sentiment === 'neutral' ? 10 : 0
    const score = sentimentFactor + urgentHits * 30
    return Math.min(100, score)
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      this.blocked += 1
      this.audit('grade_blocked', { grade })
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
