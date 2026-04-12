/**
 * Feedback Loop Optimizer — SVC-AI-ADV-R121
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R121.design.md
 * Plan SC: FR-R121.1 ~ FR-R121.8
 *
 * 사용자 피드백 수집 → 통계 기반 variant 승격/강등 루프.
 * CSAP D-06 감사, D-09 PII 제거, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type Signal = 'thumbs-up' | 'thumbs-down' | 'report' | 'neutral'

export type Rating = 1 | 2 | 3 | 4 | 5

export interface Variant {
  id: string
  description: string
  status: 'active' | 'promoted' | 'demoted'
}

export interface Feedback {
  variantId: string
  rating: Rating
  signal: Signal
  comment?: string
  grade: DataGrade
  timestamp?: string
}

export interface VariantStats {
  variantId: string
  totalSamples: number
  avgRating: number
  ciLower: number
  ciUpper: number
  thumbsUp: number
  thumbsDown: number
  reports: number
}

export interface OptimizationDecision {
  promoted: string[]
  demoted: string[]
  insufficient: string[]
}

export interface OptAuditEntry {
  timestamp: string
  action:
    | 'registerVariant'
    | 'recordFeedback'
    | 'gradeBlocked'
    | 'piiScrubbed'
    | 'optimize'
    | 'promote'
    | 'demote'
  detail?: Record<string, unknown>
}

export interface OptimizerOptions {
  minSamples?: number
  promoteThreshold?: number
  demoteThreshold?: number
  reportTolerance?: number
}

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: '[EMAIL]',
  },
  { pattern: /\b\d{6}[-]?\d{7}\b/g, replacement: '[RRN]' },
  { pattern: /\b01[0-9]-?\d{3,4}-?\d{4}\b/g, replacement: '[PHONE]' },
]

function scrubPII(text: string): { text: string; masked: number } {
  let v = text
  let masked = 0
  for (const { pattern, replacement } of PII_PATTERNS) {
    const m = v.match(pattern)
    if (m) {
      masked += m.length
      v = v.replace(pattern, replacement)
    }
  }
  return { text: v, masked }
}

export class FeedbackLoopOptimizer {
  private readonly variants: Map<string, Variant> = new Map()
  private readonly feedback: Map<string, Feedback[]> = new Map()
  private readonly minSamples: number
  private readonly promoteThreshold: number
  private readonly demoteThreshold: number
  private readonly reportTolerance: number
  private readonly auditLog: OptAuditEntry[] = []

  constructor(options: OptimizerOptions = {}) {
    this.minSamples = options.minSamples ?? 30
    this.promoteThreshold = options.promoteThreshold ?? 4.0
    this.demoteThreshold = options.demoteThreshold ?? 2.5
    this.reportTolerance = options.reportTolerance ?? 5
  }

  getAuditLog(): readonly OptAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: OptAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R121.1: variant 등록.
   */
  registerVariant(v: Omit<Variant, 'status'>): void {
    this.variants.set(v.id, { ...v, status: 'active' })
    this.feedback.set(v.id, [])
    this.audit('registerVariant', { id: v.id })
  }

  listVariants(): Variant[] {
    return Array.from(this.variants.values())
  }

  /**
   * FR-R121.2 / FR-R121.6 / FR-R121.7: 피드백 기록.
   */
  recordFeedback(feedback: Feedback): void {
    if (feedback.grade === DataGrade.C || feedback.grade === DataGrade.S) {
      this.audit('gradeBlocked', {
        grade: feedback.grade,
        variantId: feedback.variantId,
      })
      throw new Error(
        `BLOCKED: ${feedback.grade}등급 피드백은 전송 금지 (N2SF N-05)`,
      )
    }

    const variant = this.variants.get(feedback.variantId)
    if (!variant) {
      throw new Error(`Unknown variant: ${feedback.variantId}`)
    }

    let comment = feedback.comment
    if (comment) {
      const scrubbed = scrubPII(comment)
      if (scrubbed.masked > 0) {
        this.audit('piiScrubbed', {
          variantId: feedback.variantId,
          count: scrubbed.masked,
        })
      }
      comment = scrubbed.text
    }

    const list = this.feedback.get(feedback.variantId) ?? []
    list.push({
      ...feedback,
      ...(comment !== undefined ? { comment } : {}),
      timestamp: feedback.timestamp ?? new Date().toISOString(),
    })
    this.feedback.set(feedback.variantId, list)
    this.audit('recordFeedback', {
      variantId: feedback.variantId,
      rating: feedback.rating,
      signal: feedback.signal,
    })
  }

  /**
   * FR-R121.3: 통계 계산.
   */
  getStats(variantId: string): VariantStats | undefined {
    const list = this.feedback.get(variantId)
    if (!list) return undefined

    const total = list.length
    if (total === 0) {
      return {
        variantId,
        totalSamples: 0,
        avgRating: 0,
        ciLower: 0,
        ciUpper: 0,
        thumbsUp: 0,
        thumbsDown: 0,
        reports: 0,
      }
    }

    const sum = list.reduce((s, f) => s + f.rating, 0)
    const avg = sum / total
    const variance =
      list.reduce((s, f) => s + Math.pow(f.rating - avg, 2), 0) / total
    const std = Math.sqrt(variance)
    const margin = 1.96 * (std / Math.sqrt(total))

    return {
      variantId,
      totalSamples: total,
      avgRating: avg,
      ciLower: avg - margin,
      ciUpper: avg + margin,
      thumbsUp: list.filter((f) => f.signal === 'thumbs-up').length,
      thumbsDown: list.filter((f) => f.signal === 'thumbs-down').length,
      reports: list.filter((f) => f.signal === 'report').length,
    }
  }

  /**
   * FR-R121.4 / FR-R121.5: 최적화 결정.
   */
  optimize(): OptimizationDecision {
    const decision: OptimizationDecision = {
      promoted: [],
      demoted: [],
      insufficient: [],
    }

    for (const variant of this.variants.values()) {
      const stats = this.getStats(variant.id)
      if (!stats || stats.totalSamples < this.minSamples) {
        decision.insufficient.push(variant.id)
        continue
      }

      if (
        stats.reports > this.reportTolerance ||
        stats.ciUpper < this.demoteThreshold
      ) {
        variant.status = 'demoted'
        decision.demoted.push(variant.id)
        this.audit('demote', { id: variant.id, stats })
        continue
      }

      if (stats.ciLower > this.promoteThreshold) {
        variant.status = 'promoted'
        decision.promoted.push(variant.id)
        this.audit('promote', { id: variant.id, stats })
      }
    }

    this.audit('optimize', {
      promoted: decision.promoted.length,
      demoted: decision.demoted.length,
      insufficient: decision.insufficient.length,
    })
    return decision
  }
}
