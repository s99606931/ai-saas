/**
 * Bid Award Predictor — SVC-AI-ADV-R146
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R146.design.md
 * Plan SC: FR-R146.1 ~ FR-R146.6
 *
 * 공공 입찰 낙찰 확률 결정론적 예측.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface BidFeatures {
  bidId: string
  price: number
  techScore: number
  priorWins: number
  experienceYears: number
}

export interface PredictWeights {
  price: number
  tech: number
  wins: number
  experience: number
}

export interface PredictConfig {
  budget: number
  weights?: Partial<PredictWeights>
}

export interface BidPrediction {
  bidId: string
  rawScore: number
  probability: number
  rank: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface PredictorOptions {
  now?: () => number
}

const DEFAULT_WEIGHTS: PredictWeights = {
  price: 0.4,
  tech: 0.3,
  wins: 0.15,
  experience: 0.15,
}

export class BidAwardPredictor {
  private readonly bids = new Map<string, BidFeatures>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: PredictorOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R146.1: 입찰 등록 */
  submit(bid: BidFeatures, grade: DataGrade = 'O'): void {
    this.assertGrade(grade)
    if (!bid.bidId) {
      throw new Error('invalid_bid')
    }
    if (bid.price < 0) {
      throw new Error('invalid_price')
    }
    if (bid.techScore < 0 || bid.techScore > 100) {
      throw new Error('invalid_tech')
    }
    if (bid.priorWins < 0 || bid.experienceYears < 0) {
      throw new Error('invalid_feature')
    }
    if (this.bids.has(bid.bidId)) {
      throw new Error('duplicate_bid')
    }
    this.bids.set(bid.bidId, { ...bid })
    this.audit('bid_submitted', { bidId: bid.bidId })
  }

  /** FR-R146.2 ~ FR-R146.4: 예측 및 랭킹 */
  predict(config: PredictConfig): BidPrediction[] {
    if (config.budget <= 0) {
      throw new Error('invalid_budget')
    }
    const weights: PredictWeights = {
      ...DEFAULT_WEIGHTS,
      ...config.weights,
    }
    const results: BidPrediction[] = []
    for (const bid of this.bids.values()) {
      const priceScore = this.computePriceScore(bid.price, config.budget)
      const techNorm = bid.techScore / 100
      const winsNorm = Math.min(bid.priorWins / 10, 1)
      const expNorm = Math.min(bid.experienceYears / 20, 1)
      const raw =
        weights.price * priceScore +
        weights.tech * techNorm +
        weights.wins * winsNorm +
        weights.experience * expNorm
      const probability = this.sigmoid(6 * (raw - 0.5))
      results.push({
        bidId: bid.bidId,
        rawScore: this.round6(raw),
        probability: this.round6(probability),
        rank: 0,
      })
    }
    results.sort((a, b) => {
      if (b.probability !== a.probability) {
        return b.probability - a.probability
      }
      return a.bidId.localeCompare(b.bidId)
    })
    results.forEach((r, idx) => {
      r.rank = idx + 1
    })
    this.audit('predicted', {
      budget: config.budget,
      count: results.length,
    })
    return results
  }

  /** FR-R146.5: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private computePriceScore(price: number, budget: number): number {
    const optimal = 0.8 * budget
    const max = 1.2 * budget
    if (price <= optimal) return 1
    if (price >= max) return 0
    return (max - price) / (max - optimal)
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x))
  }

  private round6(n: number): number {
    return Math.round(n * 1e6) / 1e6
  }

  /** FR-R146.6: C/S등급 차단 */
  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
