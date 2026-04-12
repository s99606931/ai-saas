/**
 * AI-Powered SLA Negotiator — SVC-AI-ADV-R138
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R138.design.md
 * Plan SC: FR-R138.1 ~ FR-R138.6
 *
 * 공공기관 SaaS 조달 계약 SLA 자동 협상 엔진.
 * 제안 SLA vs 운영 이력 비교 → 달성 가능성·위약금 계산 → 3개 대안 조항 생성.
 * N2SF O등급 메타데이터만 사용 — AI 외부 API 호출 없음 (순수 수학 모델).
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface SlaProposal {
  availability: number
  rtoMinutes: number
  rpoMinutes: number
  responseTimeMs: number
  monthlyRevenue: number
  penaltyRate: number
}

export interface OperationHistory {
  avgAvailability: number
  avgRtoMinutes: number
  avgRpoMinutes: number
  avgResponseTimeMs: number
  samplesCount: number
}

export type NegotiationStance = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'

export interface AlternativeClause {
  stance: NegotiationStance
  availability: number
  rtoMinutes: number
  rpoMinutes: number
  rationale: string
}

export interface NegotiationResult {
  feasibilityScore: number
  violationProbability: number
  expectedPenaltyPerMonth: number
  alternatives: AlternativeClause[]
  recommendation: 'ACCEPT' | 'NEGOTIATE' | 'REJECT'
  analyzedAt: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface NegotiatorOptions {
  now?: () => number
}

export class SlaNegotiatorAI {
  private readonly now: () => number
  private readonly auditLog: AuditEntry[] = []

  constructor(opts: NegotiatorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * 전체 분석 파이프라인.
   * FR-R138.1 ~ FR-R138.4
   */
  analyze(
    proposal: SlaProposal,
    history: OperationHistory,
    grade: DataGrade = 'O',
  ): NegotiationResult {
    this.assertDataGrade(grade)
    this.validateProposal(proposal)

    const feasibilityScore = this.computeFeasibility(proposal, history)
    const violationProbability = this.computeViolationProbability(proposal, history)
    const expectedPenaltyPerMonth = this.estimatePenalty(proposal, violationProbability)
    const alternatives = this.generateAlternatives(proposal, history)
    const recommendation = this.decideRecommendation(feasibilityScore, violationProbability)

    const result: NegotiationResult = {
      feasibilityScore,
      violationProbability,
      expectedPenaltyPerMonth,
      alternatives,
      recommendation,
      analyzedAt: this.now(),
    }

    this.auditLog.push({
      event: 'sla.negotiation.analyzed',
      detail: {
        availability: proposal.availability,
        feasibilityScore,
        recommendation,
      },
      at: this.now(),
    })

    return result
  }

  /**
   * 달성 가능성 점수 (0~1).
   * FR-R138.2
   */
  computeFeasibility(proposal: SlaProposal, history: OperationHistory): number {
    if (history.samplesCount <= 0) {
      return 0
    }
    const availScore = this.ratioScore(history.avgAvailability, proposal.availability)
    const rtoScore = this.inverseRatioScore(proposal.rtoMinutes, history.avgRtoMinutes)
    const rpoScore = this.inverseRatioScore(proposal.rpoMinutes, history.avgRpoMinutes)
    const respScore = this.inverseRatioScore(proposal.responseTimeMs, history.avgResponseTimeMs)
    const weighted = availScore * 0.5 + rtoScore * 0.2 + rpoScore * 0.15 + respScore * 0.15
    return Math.max(0, Math.min(1, weighted))
  }

  /**
   * 위약금 계산.
   * FR-R138.3
   */
  estimatePenalty(proposal: SlaProposal, violationProbability: number): number {
    const clampedProb = Math.max(0, Math.min(1, violationProbability))
    return proposal.monthlyRevenue * proposal.penaltyRate * clampedProb
  }

  /**
   * 3개 대안 조항 생성.
   * FR-R138.4
   */
  generateAlternatives(
    proposal: SlaProposal,
    history: OperationHistory,
  ): AlternativeClause[] {
    const safeAvail = Math.min(proposal.availability, history.avgAvailability)
    const safeRto = Math.max(proposal.rtoMinutes, history.avgRtoMinutes)
    const safeRpo = Math.max(proposal.rpoMinutes, history.avgRpoMinutes)

    return [
      {
        stance: 'CONSERVATIVE',
        availability: Math.max(0.99, safeAvail - 0.005),
        rtoMinutes: safeRto * 1.5,
        rpoMinutes: safeRpo * 1.5,
        rationale: '운영 이력 기반 안전 마진 50% 적용. 위약 리스크 최소화',
      },
      {
        stance: 'BALANCED',
        availability: safeAvail,
        rtoMinutes: safeRto * 1.1,
        rpoMinutes: safeRpo * 1.1,
        rationale: '이력 평균 수준 유지. 수용 가능성과 신뢰도 균형',
      },
      {
        stance: 'AGGRESSIVE',
        availability: Math.min(0.9999, proposal.availability),
        rtoMinutes: Math.min(proposal.rtoMinutes, safeRto),
        rpoMinutes: Math.min(proposal.rpoMinutes, safeRpo),
        rationale: '제안 원안 대부분 수용. 경쟁 입찰 승리 우선',
      },
    ]
  }

  /**
   * 감사 로그 조회.
   * FR-R138.5
   */
  getAuditLog(): ReadonlyArray<AuditEntry> {
    return [...this.auditLog]
  }

  /**
   * N2SF 등급 차단.
   * FR-R138.6
   */
  private assertDataGrade(grade: DataGrade): void {
    if (grade !== 'O') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 SLA Negotiator 전송 금지 (N2SF N-05)`,
      )
    }
  }

  private validateProposal(proposal: SlaProposal): void {
    if (proposal.availability < 0 || proposal.availability > 1) {
      throw new Error('INVALID_PROPOSAL: availability must be 0~1')
    }
    if (proposal.monthlyRevenue < 0 || proposal.penaltyRate < 0) {
      throw new Error('INVALID_PROPOSAL: revenue/penaltyRate must be >= 0')
    }
  }

  private computeViolationProbability(
    proposal: SlaProposal,
    history: OperationHistory,
  ): number {
    if (history.samplesCount <= 0) {
      return 1
    }
    const gap = proposal.availability - history.avgAvailability
    if (gap <= 0) {
      return 0.05
    }
    // gap 0.001 -> 0.1, gap 0.01 -> 1.0 근사
    return Math.max(0, Math.min(1, gap * 100))
  }

  private decideRecommendation(
    feasibility: number,
    violationProb: number,
  ): 'ACCEPT' | 'NEGOTIATE' | 'REJECT' {
    if (feasibility >= 0.9 && violationProb <= 0.1) {
      return 'ACCEPT'
    }
    if (feasibility >= 0.6) {
      return 'NEGOTIATE'
    }
    return 'REJECT'
  }

  private ratioScore(actual: number, target: number): number {
    if (target <= 0) {
      return 1
    }
    return Math.max(0, Math.min(1, actual / target))
  }

  private inverseRatioScore(target: number, actual: number): number {
    if (actual <= 0) {
      return 1
    }
    if (target <= 0) {
      return 0
    }
    return Math.max(0, Math.min(1, target / actual))
  }
}
