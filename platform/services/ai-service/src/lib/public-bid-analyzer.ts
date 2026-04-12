/**
 * 공공 입찰 분석 AI — SVC-AI-ADV-R159
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R159/SVC-AI-ADV-R159.design.md
 * Plan SC: FR-R159.1 ~ FR-R159.5
 *
 * 입찰 공고 자동 분석 + 적격성 평가 + 최적 응찰 전략 추천.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface BidNotice {
  id: string
  title: string
  budget: number
  requirements: string[]
  deadline: string
  category: string
}

export interface CompanyProfile {
  capabilities: string[]
  pastBudgetRange: [number, number]
  certifications: string[]
}

export type BidStrategy = 'conservative' | 'aggressive' | 'priority'

export interface BidAnalysis {
  noticeId: string
  eligibilityScore: number
  eligibilityGaps: string[]
  budgetFit: boolean
  recommendedStrategy: BidStrategy
  winProbability: number
  recommendations: string[]
}

export interface BidAuditEntry {
  action: 'noticeRegistered' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class PublicBidAnalyzer {
  private readonly notices = new Map<string, BidNotice>()
  private readonly auditLog: BidAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 입찰 분석 AI 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R159.1 */
  registerNotice(notice: BidNotice): void {
    if (!notice.id.trim()) throw new Error('notice id must not be empty')
    if (notice.budget <= 0) throw new Error('budget must be > 0')
    this.notices.set(notice.id, { ...notice })
    this.audit('noticeRegistered', { id: notice.id, budget: notice.budget })
  }

  /** FR-R159.2 ~ FR-R159.4 */
  analyze(noticeId: string, profile: CompanyProfile): BidAnalysis {
    const notice = this.notices.get(noticeId)
    if (!notice) throw new Error(`unknown notice: ${noticeId}`)

    // 적격성 분석
    const capSet = new Set(profile.capabilities.map((c) => c.toLowerCase()))
    const certSet = new Set(profile.certifications.map((c) => c.toLowerCase()))
    const allCapabilities = new Set([...capSet, ...certSet])
    const reqSet = new Set(notice.requirements.map((r) => r.toLowerCase()))

    let metCount = 0
    const gaps: string[] = []
    for (const req of reqSet) {
      if (allCapabilities.has(req)) {
        metCount++
      } else {
        gaps.push(req)
      }
    }

    const eligibilityScore = reqSet.size > 0 ? metCount / reqSet.size : 1

    // 예산 적합성
    const [minBudget, maxBudget] = profile.pastBudgetRange
    const budgetFit = notice.budget >= (minBudget ?? 0) && notice.budget <= (maxBudget ?? Infinity)

    // 전략 및 승률
    let strategy: BidStrategy
    if (eligibilityScore >= 0.8) {
      strategy = 'aggressive'
    } else if (eligibilityScore >= 0.5) {
      strategy = 'conservative'
    } else {
      strategy = 'priority'
    }

    const winProbability = eligibilityScore * (budgetFit ? 1.0 : 0.5)

    const recommendations: string[] = []
    if (gaps.length > 0) {
      recommendations.push(`미충족 요건 보완 필요: ${gaps.slice(0, 3).join(', ')}`)
    }
    if (!budgetFit) {
      recommendations.push(`예산 범위(${notice.budget.toLocaleString()}원) 조정 검토`)
    }
    if (winProbability >= 0.7) {
      recommendations.push('적극적 입찰 참여 권고')
    }

    const analysis: BidAnalysis = {
      noticeId,
      eligibilityScore,
      eligibilityGaps: gaps,
      budgetFit,
      recommendedStrategy: strategy,
      winProbability,
      recommendations,
    }

    this.audit('analyzed', { noticeId, eligibilityScore, strategy })
    return analysis
  }

  /** FR-R159.5 */
  getAuditLog(): readonly BidAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private audit(action: BidAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
