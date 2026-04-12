/**
 * AI Usage Forecaster — SVC-AI-ADV-R126
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R126.design.md
 * Plan SC: FR-R126.1 ~ FR-R126.9
 *
 * Holt 지수평활(level + trend) 기반 사용량 예측 + MAPE + 95% CI.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface UsagePoint {
  timestamp: number
  value: number
  grade: DataGrade
}

export interface ForecastPoint {
  step: number
  value: number
  lower: number
  upper: number
}

export interface ForecastResult {
  points: ForecastPoint[]
  mape: number
  alpha: number
  beta: number
  trainSize: number
  residualStdDev: number
}

export interface ForecasterAuditEntry {
  timestamp: string
  action: 'addPoint' | 'forecast' | 'fitParameters' | 'reset' | 'gradeBlocked'
  detail?: Record<string, unknown>
}

interface SmoothingState {
  level: number[]
  trend: number[]
  predicted: number[]
}

const ALPHA_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const BETA_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const Z_95 = 1.96

export class AIUsageForecaster {
  private readonly points: UsagePoint[] = []
  private readonly auditLog: ForecasterAuditEntry[] = []

  getAuditLog(): readonly ForecasterAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: ForecasterAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  size(): number {
    return this.points.length
  }

  /**
   * FR-R126.1 / FR-R126.8: 데이터 추가 + 등급 guard.
   */
  addPoint(p: UsagePoint): void {
    if (p.grade === DataGrade.C || p.grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade: p.grade })
      throw new Error(
        `BLOCKED: ${p.grade}등급 사용량 데이터 차단 (N2SF N-05)`,
      )
    }
    if (!Number.isFinite(p.value) || p.value < 0) {
      throw new Error('value must be non-negative finite')
    }
    this.points.push({ timestamp: p.timestamp, value: p.value, grade: p.grade })
    this.points.sort((a, b) => a.timestamp - b.timestamp)
    this.audit('addPoint', { timestamp: p.timestamp, value: p.value })
  }

  reset(): void {
    this.points.length = 0
    this.audit('reset')
  }

  /**
   * Holt 지수평활 — in-sample 1-step ahead 예측 시퀀스 생성.
   */
  private smooth(alpha: number, beta: number): SmoothingState {
    const n = this.points.length
    const level: number[] = new Array(n).fill(0)
    const trend: number[] = new Array(n).fill(0)
    const predicted: number[] = new Array(n).fill(0)

    if (n === 0) return { level, trend, predicted }

    const v0 = this.points[0]?.value ?? 0
    const v1 = this.points[1]?.value ?? v0
    level[0] = v0
    trend[0] = v1 - v0
    predicted[0] = v0

    for (let t = 1; t < n; t++) {
      const y = this.points[t]?.value ?? 0
      const prevLevel = level[t - 1] ?? 0
      const prevTrend = trend[t - 1] ?? 0
      // 1-step ahead 예측 (이전 상태로)
      predicted[t] = prevLevel + prevTrend
      const newLevel = alpha * y + (1 - alpha) * (prevLevel + prevTrend)
      const newTrend = beta * (newLevel - prevLevel) + (1 - beta) * prevTrend
      level[t] = newLevel
      trend[t] = newTrend
    }

    return { level, trend, predicted }
  }

  private computeMAPE(predicted: number[]): number {
    let sum = 0
    let count = 0
    for (let t = 1; t < this.points.length; t++) {
      const actual = this.points[t]?.value ?? 0
      const pred = predicted[t] ?? 0
      const denom = Math.max(Math.abs(actual), 1)
      sum += Math.abs(actual - pred) / denom
      count++
    }
    if (count === 0) return 0
    return (sum / count) * 100
  }

  private computeResidualStdDev(predicted: number[]): number {
    const residuals: number[] = []
    for (let t = 1; t < this.points.length; t++) {
      const actual = this.points[t]?.value ?? 0
      const pred = predicted[t] ?? 0
      residuals.push(actual - pred)
    }
    if (residuals.length < 2) return 0
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length
    const variance =
      residuals.reduce((a, b) => a + (b - mean) ** 2, 0) /
      (residuals.length - 1)
    return Math.sqrt(variance)
  }

  /**
   * FR-R126.7: 격자 탐색 fit.
   */
  fitParameters(): { alpha: number; beta: number; mape: number } {
    if (this.points.length < 3) {
      throw new Error('at least 3 points required for fitting')
    }
    let bestAlpha = 0.5
    let bestBeta = 0.5
    let bestMape = Number.POSITIVE_INFINITY

    for (const alpha of ALPHA_GRID) {
      for (const beta of BETA_GRID) {
        const { predicted } = this.smooth(alpha, beta)
        const mape = this.computeMAPE(predicted)
        if (mape < bestMape) {
          bestMape = mape
          bestAlpha = alpha
          bestBeta = beta
        }
      }
    }

    this.audit('fitParameters', {
      alpha: bestAlpha,
      beta: bestBeta,
      mape: bestMape,
    })
    return { alpha: bestAlpha, beta: bestBeta, mape: bestMape }
  }

  /**
   * FR-R126.2~5: N-step 예측 + 신뢰구간.
   */
  forecast(
    steps: number,
    options: { alpha?: number; beta?: number } = {},
  ): ForecastResult {
    if (this.points.length < 3) {
      throw new Error('at least 3 points required for forecast')
    }
    if (steps < 1) {
      throw new Error('steps must be >= 1')
    }

    const alpha = options.alpha ?? 0.5
    const beta = options.beta ?? 0.3
    if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1) {
      throw new Error('alpha/beta must be in [0, 1]')
    }

    const { level, trend, predicted } = this.smooth(alpha, beta)
    const mape = this.computeMAPE(predicted)
    const stddev = this.computeResidualStdDev(predicted)
    const lastIdx = this.points.length - 1
    const lastLevel = level[lastIdx] ?? 0
    const lastTrend = trend[lastIdx] ?? 0

    const points: ForecastPoint[] = []
    for (let h = 1; h <= steps; h++) {
      const value = lastLevel + h * lastTrend
      const halfWidth = Z_95 * stddev * Math.sqrt(h)
      points.push({
        step: h,
        value,
        lower: Math.max(0, value - halfWidth),
        upper: value + halfWidth,
      })
    }

    this.audit('forecast', {
      steps,
      alpha,
      beta,
      mape,
    })

    return {
      points,
      mape,
      alpha,
      beta,
      trainSize: this.points.length,
      residualStdDev: stddev,
    }
  }
}
