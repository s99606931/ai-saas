/**
 * Hallucination Scorer — SVC-AI-ADV-R160
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R160.design.md
 * Plan SC: FR-R160.1 ~ FR-R160.8
 *
 * AI 응답의 환각 가능성을 정량 점수화한다.
 * 참조 근거 토큰 일치도와 불확실 표현 탐지를 결합하여 0~1 점수 반환.
 */

export type DataGrade = 'O' | 'C' | 'S'
export type ScoreLevel = 'low' | 'medium' | 'high'

export interface ScoreResult {
  score: number
  level: ScoreLevel
  reasons: string[]
}

export interface ScorerStats {
  total: number
  sumScore: number
  levels: Record<ScoreLevel, number>
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface ScorerOptions {
  now?: () => number
  hedgeWeight?: number
}

const HEDGE_TOKENS = [
  '아마',
  '것 같',
  '인 듯',
  '추측',
  '불확실',
  'perhaps',
  'maybe',
  'probably',
  'might',
]

export class HallucinationScorer {
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly hedgeWeight: number
  private stats: ScorerStats = {
    total: 0,
    sumScore: 0,
    levels: { low: 0, medium: 0, high: 0 },
  }

  constructor(opts: ScorerOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.hedgeWeight = opts.hedgeWeight ?? 0.2
  }

  /** FR-R160.1: 환각 점수 계산 */
  score(response: string, citations: string[], grade: DataGrade = 'O'): ScoreResult {
    this.assertGrade(grade)
    if (typeof response !== 'string' || response.trim().length === 0) {
      throw new Error('empty_response')
    }
    if (!Array.isArray(citations)) {
      throw new Error('invalid_citations')
    }

    const reasons: string[] = []
    let score: number

    if (citations.length === 0) {
      score = 0.9
      reasons.push('citations_empty: 근거 자료 미제공')
    } else {
      const responseTokens = tokenize(response)
      const citationTokens = new Set<string>()
      for (const c of citations) {
        for (const t of tokenize(c)) citationTokens.add(t)
      }

      const overlapCount = responseTokens.filter((t) => citationTokens.has(t)).length
      const overlap = responseTokens.length === 0 ? 0 : overlapCount / responseTokens.length

      const baseScore = 1 - overlap
      reasons.push(
        `overlap_ratio: ${overlap.toFixed(3)} (응답 토큰 ${responseTokens.length}개 중 ${overlapCount}개 근거 일치)`,
      )
      score = baseScore
    }

    const hedgeRatio = this.detectHedges(response)
    if (hedgeRatio > 0) {
      const add = hedgeRatio * this.hedgeWeight
      score += add
      reasons.push(`hedge_detected: 불확실 표현 비율 ${hedgeRatio.toFixed(3)}`)
    }

    score = Math.max(0, Math.min(1, score))
    const level = this.levelOf(score)

    this.stats.total += 1
    this.stats.sumScore += score
    this.stats.levels[level] += 1

    this.audit('scored', { score, level, reasonCount: reasons.length })

    return { score, level, reasons }
  }

  getStats(): { total: number; averageScore: number; levels: Record<ScoreLevel, number> } {
    const avg = this.stats.total > 0 ? this.stats.sumScore / this.stats.total : 0
    return {
      total: this.stats.total,
      averageScore: avg,
      levels: { ...this.stats.levels },
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private levelOf(score: number): ScoreLevel {
    if (score < 0.3) return 'low'
    if (score < 0.7) return 'medium'
    return 'high'
  }

  private detectHedges(text: string): number {
    const lowered = text.toLowerCase()
    let count = 0
    for (const h of HEDGE_TOKENS) {
      if (lowered.includes(h.toLowerCase())) count += 1
    }
    return Math.min(1, count / 3)
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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}
