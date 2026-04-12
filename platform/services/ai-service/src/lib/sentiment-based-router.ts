/**
 * Sentiment-Based Router — SVC-AI-ADV-R150
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R150.design.md
 * Plan SC: FR-R150.1 ~ FR-R150.6
 *
 * 부정·긴급 키워드 기반 민원 자동 큐 라우팅.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type RouteQueue = 'HIGH' | 'NORMAL' | 'LOW'

export interface KeywordHit {
  term: string
  weight: number
}

export interface RouteDecision {
  queue: RouteQueue
  score: number
  negativeScore: number
  urgencyScore: number
  negativeHits: KeywordHit[]
  urgencyHits: KeywordHit[]
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface RouterOptions {
  now?: () => number
  highThreshold?: number
  normalThreshold?: number
}

const DEFAULT_NEGATIVE: Record<string, number> = {
  불만: 0.3,
  억울: 0.4,
  화가: 0.4,
  분노: 0.5,
  실망: 0.3,
  최악: 0.5,
  너무하: 0.3,
  불쾌: 0.3,
  angry: 0.4,
  terrible: 0.4,
  awful: 0.4,
  disappointed: 0.3,
}

const DEFAULT_URGENCY: Record<string, number> = {
  긴급: 0.6,
  당장: 0.4,
  즉시: 0.4,
  응급: 0.7,
  생명: 0.8,
  위험: 0.5,
  위독: 0.8,
  urgent: 0.6,
  emergency: 0.7,
  immediately: 0.4,
  critical: 0.6,
}

export class SentimentBasedRouter {
  private readonly negativeDict = new Map<string, number>()
  private readonly urgencyDict = new Map<string, number>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly highThreshold: number
  private readonly normalThreshold: number

  constructor(opts: RouterOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.highThreshold = opts.highThreshold ?? 0.7
    this.normalThreshold = opts.normalThreshold ?? 0.3
    for (const [term, w] of Object.entries(DEFAULT_NEGATIVE)) {
      this.negativeDict.set(term, w)
    }
    for (const [term, w] of Object.entries(DEFAULT_URGENCY)) {
      this.urgencyDict.set(term, w)
    }
  }

  /** FR-R150.1~FR-R150.5: 라우팅 결정 */
  route(text: string, grade: DataGrade = 'O'): RouteDecision {
    this.assertGrade(grade)
    if (!text || text.trim().length === 0) {
      throw new Error('invalid_input')
    }
    const normalized = text.toLowerCase()

    const negativeHits: KeywordHit[] = []
    let negSum = 0
    for (const [term, weight] of this.negativeDict) {
      if (normalized.includes(term.toLowerCase())) {
        negativeHits.push({ term, weight })
        negSum += weight
      }
    }
    const negativeScore = Math.min(1, negSum)

    const urgencyHits: KeywordHit[] = []
    let urgSum = 0
    for (const [term, weight] of this.urgencyDict) {
      if (normalized.includes(term.toLowerCase())) {
        urgencyHits.push({ term, weight })
        urgSum += weight
      }
    }
    const urgencyScore = Math.min(1, urgSum)

    const maxSide = Math.max(negativeScore, urgencyScore)
    const minSide = Math.min(negativeScore, urgencyScore)
    const score = Math.min(1, maxSide + minSide * 0.5)
    const queue: RouteQueue =
      score >= this.highThreshold
        ? 'HIGH'
        : score >= this.normalThreshold
          ? 'NORMAL'
          : 'LOW'

    this.audit('route_decided', {
      queue,
      score,
      negativeHits: negativeHits.length,
      urgencyHits: urgencyHits.length,
    })

    return {
      queue,
      score: Math.round(score * 1e6) / 1e6,
      negativeScore: Math.round(negativeScore * 1e6) / 1e6,
      urgencyScore: Math.round(urgencyScore * 1e6) / 1e6,
      negativeHits,
      urgencyHits,
    }
  }

  addNegativeKeyword(term: string, weight: number): void {
    this.assertKeyword(term, weight)
    this.negativeDict.set(term, weight)
    this.audit('neg_added', { term, weight })
  }

  addUrgencyKeyword(term: string, weight: number): void {
    this.assertKeyword(term, weight)
    this.urgencyDict.set(term, weight)
    this.audit('urg_added', { term, weight })
  }

  /** FR-R150.6: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private assertKeyword(term: string, weight: number): void {
    if (!term || weight <= 0) {
      throw new Error('invalid_keyword')
    }
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
