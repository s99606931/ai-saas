/**
 * FinOps AI Cost Engine — SVC-AI-ADV-R93
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R93.design.md
 * Plan SC: FR-R93.1 ~ FR-R93.5
 *
 * 일별 비용 시계열 → 월말 비용 예측 + 이상치 탐지.
 * 공공기관 예산 집행 효율화를 위한 투명한 통계 기반 엔진.
 */

export type CostCategory = 'LLM' | 'INFRA' | 'SAAS' | 'OTHER'

export interface CostDataPoint {
  date: string // YYYY-MM-DD
  amount: number
  category: CostCategory
}

export interface BudgetPolicy {
  category: CostCategory | 'TOTAL'
  monthlyBudget: number
  warnRatio?: number // 기본 0.8
}

export type RiskLevel = 'SAFE' | 'WARN' | 'DANGER'

export interface AnomalyPoint {
  date: string
  amount: number
  zScore: number
}

export interface CostForecast {
  category: string
  observedMtd: number
  projectedMonthly: number
  monthlyBudget: number
  utilizationRatio: number
  risk: RiskLevel
  anomalies: AnomalyPoint[]
  generatedAt: string
}

export interface AuditSink {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

export interface EngineOptions {
  audit?: AuditSink
  anomalyThreshold?: number
}

export class FinopsAiEngine {
  private readonly audit?: AuditSink
  private readonly defaultAnomalyThreshold: number

  constructor(opts: EngineOptions = {}) {
    this.audit = opts.audit
    this.defaultAnomalyThreshold = opts.anomalyThreshold ?? 2.0
  }

  /**
   * 월말 비용 예측 + 이상치 탐지. FR-R93.1~4
   */
  forecast(
    series: CostDataPoint[],
    policy: BudgetPolicy,
    now: Date = new Date(),
  ): CostForecast {
    if (series.length === 0) {
      throw new Error('series must not be empty')
    }

    // 카테고리 필터
    const filtered =
      policy.category === 'TOTAL'
        ? series
        : series.filter((p) => p.category === policy.category)

    // 당월 데이터만 사용
    const currentMonth = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`
    const mtdPoints = filtered.filter((p) => p.date.startsWith(currentMonth))

    const observedMtd = mtdPoints.reduce((acc, p) => acc + p.amount, 0)

    // 경과일 / 월 총일수
    const elapsedDays = Math.max(1, now.getUTCDate())
    const daysInMonth = this.daysInMonth(now)
    const remainingDays = Math.max(0, daysInMonth - elapsedDays)

    // 일평균 = MTD / 경과일
    const dailyAvg = observedMtd / elapsedDays
    const projectedMonthly = observedMtd + dailyAvg * remainingDays

    const utilizationRatio =
      policy.monthlyBudget > 0 ? projectedMonthly / policy.monthlyBudget : 0

    const warnRatio = policy.warnRatio ?? 0.8
    const risk: RiskLevel =
      utilizationRatio >= 1.0
        ? 'DANGER'
        : utilizationRatio >= warnRatio
          ? 'WARN'
          : 'SAFE'

    const anomalies = this.detectAnomalies(mtdPoints)

    return {
      category: policy.category,
      observedMtd,
      projectedMonthly,
      monthlyBudget: policy.monthlyBudget,
      utilizationRatio,
      risk,
      anomalies,
      generatedAt: now.toISOString(),
    }
  }

  /**
   * z-score 기반 이상치 탐지. FR-R93.3
   */
  detectAnomalies(
    series: CostDataPoint[],
    threshold: number = this.defaultAnomalyThreshold,
  ): AnomalyPoint[] {
    if (series.length < 3) return []
    const amounts = series.map((p) => p.amount)
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const variance =
      amounts.reduce((acc, x) => acc + (x - mean) ** 2, 0) / amounts.length
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) return []

    const result: AnomalyPoint[] = []
    for (const p of series) {
      const z = (p.amount - mean) / stdDev
      if (Math.abs(z) > threshold) {
        result.push({ date: p.date, amount: p.amount, zScore: z })
      }
    }
    return result
  }

  /**
   * 여러 카테고리 일괄 예측 + 감사 로그. FR-R93.5
   */
  async forecastBatch(
    series: CostDataPoint[],
    policies: BudgetPolicy[],
    now: Date = new Date(),
  ): Promise<CostForecast[]> {
    const results = policies.map((policy) => this.forecast(series, policy, now))
    if (this.audit) {
      await this.audit.log('finops.forecast.batch', {
        count: results.length,
        danger: results.filter((r) => r.risk === 'DANGER').length,
      })
    }
    return results
  }

  private daysInMonth(date: Date): number {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate()
  }
}
