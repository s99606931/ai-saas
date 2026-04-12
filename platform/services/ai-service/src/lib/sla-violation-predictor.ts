/**
 * SLA Violation Predictor — SVC-AI-ADV-R91
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R91.design.md
 * Plan SC: FR-R91.1 ~ FR-R91.5
 *
 * 에러버짓 소진률 기반 SLA 위반 예측 (선형 외삽).
 * 공공기관 SaaS의 SLA 99.9% 유지를 위한 선제 대응 엔진.
 * N2SF O등급 메트릭만 사용 — AI 호출 없음.
 */

export interface SliDataPoint {
  timestamp: number // epoch ms
  value: number // 0.0 ~ 1.0 (가용성)
}

export interface SloTarget {
  serviceId: string
  targetAvailability: number // 예: 0.999
  windowMs: number // 예: 30d
}

export type Recommendation = 'NONE' | 'MONITOR' | 'SCALE_UP' | 'ESCALATE'

export interface PredictionResult {
  serviceId: string
  willViolate: boolean
  predictedViolationAt: number | null
  remainingBudgetRatio: number
  burnRate: number
  confidence: number
  recommendation: Recommendation
  analyzedAt: number
}

export interface AuditSink {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

export interface PredictorOptions {
  audit?: AuditSink
  now?: () => number
}

export class SlaViolationPredictor {
  private readonly audit?: AuditSink
  private readonly now: () => number

  constructor(opts: PredictorOptions = {}) {
    this.audit = opts.audit
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * 단일 서비스 SLO 위반 예측.
   * FR-R91.1 ~ FR-R91.4
   */
  predict(target: SloTarget, series: SliDataPoint[]): PredictionResult {
    const analyzedAt = this.now()
    if (series.length === 0) {
      return this.emptyResult(target, analyzedAt)
    }

    const totalBudget = 1 - target.targetAvailability // 허용 실패율
    const observedFailureRate = this.computeFailureRate(series)
    const burnRate = totalBudget > 0 ? observedFailureRate / totalBudget : 0

    const remainingBudgetRatio = Math.max(
      0,
      Math.min(1, 1 - observedFailureRate / Math.max(totalBudget, 1e-9)),
    )

    const recommendation = this.classify(burnRate)
    const confidence = Math.min(1, series.length / 30)

    // 위반시점 = now + (남은 버짓 / 시간당 소진량)
    let predictedViolationAt: number | null = null
    if (burnRate > 1 && remainingBudgetRatio > 0) {
      const elapsed = this.seriesDurationMs(series)
      const consumedRatio = 1 - remainingBudgetRatio
      if (consumedRatio > 1e-9 && elapsed > 0) {
        const msPerRatio = elapsed / consumedRatio
        predictedViolationAt =
          analyzedAt + Math.round(msPerRatio * remainingBudgetRatio)
      }
    }

    const willViolate = burnRate > 1 && predictedViolationAt !== null

    return {
      serviceId: target.serviceId,
      willViolate,
      predictedViolationAt,
      remainingBudgetRatio,
      burnRate,
      confidence,
      recommendation,
      analyzedAt,
    }
  }

  /**
   * 배치 예측 + 감사 로그. FR-R91.5
   */
  async predictBatch(
    targets: Array<{ target: SloTarget; series: SliDataPoint[] }>,
  ): Promise<PredictionResult[]> {
    const results = targets.map(({ target, series }) =>
      this.predict(target, series),
    )
    if (this.audit) {
      await this.audit.log('sla.predict.batch', {
        count: results.length,
        violations: results.filter((r) => r.willViolate).length,
      })
    }
    return results
  }

  private computeFailureRate(series: SliDataPoint[]): number {
    const sum = series.reduce((acc, p) => acc + (1 - p.value), 0)
    return sum / series.length
  }

  private seriesDurationMs(series: SliDataPoint[]): number {
    if (series.length < 2) return 0
    const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp)
    return sorted[sorted.length - 1]!.timestamp - sorted[0]!.timestamp
  }

  private classify(burnRate: number): Recommendation {
    if (burnRate < 1) return 'NONE'
    if (burnRate < 2) return 'MONITOR'
    if (burnRate < 10) return 'SCALE_UP'
    return 'ESCALATE'
  }

  private emptyResult(target: SloTarget, analyzedAt: number): PredictionResult {
    return {
      serviceId: target.serviceId,
      willViolate: false,
      predictedViolationAt: null,
      remainingBudgetRatio: 1,
      burnRate: 0,
      confidence: 0,
      recommendation: 'NONE',
      analyzedAt,
    }
  }
}
