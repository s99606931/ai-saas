/**
 * Public Service Demand Forecaster — SVC-AI-ADV-R130 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R130.design.md
 * Plan SC: FR-R130.1 ~ FR-R130.5
 *
 * 계절성/트렌드/이벤트 기반 공공 서비스 수요 예측.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export interface DemandPoint {
  serviceId: string
  timestamp: number
  value: number
}

export interface Decomposition {
  trend: number[]
  seasonal: number[]
  residual: number[]
}

export interface ForecastPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

export interface EventWeight {
  serviceId: string
  date: string
  multiplier: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class PublicServiceDemandForecaster {
  private readonly series = new Map<string, DemandPoint[]>()
  private readonly events = new Map<string, EventWeight[]>()
  private readonly auditLog: AuditEntry[] = []
  private readonly trendWindow = 7

  // Plan SC: FR-R130.1
  recordDemand(serviceId: string, timestamp: number, value: number): void {
    const points = this.series.get(serviceId) ?? []
    points.push({ serviceId, timestamp, value })
    points.sort((a, b) => a.timestamp - b.timestamp)
    this.series.set(serviceId, points)
  }

  // Plan SC: FR-R130.4
  addEvent(serviceId: string, date: string, multiplier: number): void {
    const list = this.events.get(serviceId) ?? []
    list.push({ serviceId, date, multiplier })
    this.events.set(serviceId, list)
  }

  // Plan SC: FR-R130.2 — Design Ref: §3.1 이동평균 트렌드, §3.2 계절성
  decompose(serviceId: string): Decomposition {
    const points = this.series.get(serviceId) ?? []
    if (points.length === 0) return { trend: [], seasonal: [], residual: [] }

    const values = points.map((p) => p.value)
    const trend = this.movingAverage(values, this.trendWindow)
    const detrended = values.map((v, i) => (trend[i] !== 0 ? v / trend[i]! : 1))

    // 주간 계절성: 요일별 평균
    const dayFactors = new Array(7).fill(0)
    const dayCounts = new Array(7).fill(0)
    for (let i = 0; i < points.length; i++) {
      const dow = new Date(points[i]!.timestamp).getDay()
      dayFactors[dow] += detrended[i]!
      dayCounts[dow]++
    }
    const seasonalIndices = dayFactors.map((sum, i) =>
      dayCounts[i]! > 0 ? sum / dayCounts[i]! : 1,
    )

    const seasonal = points.map((p) => seasonalIndices[new Date(p.timestamp).getDay()]!)
    const residual = values.map((v, i) =>
      seasonal[i]! !== 0 ? v / (trend[i]! * seasonal[i]!) : 0,
    )

    return { trend, seasonal, residual }
  }

  // Plan SC: FR-R130.3 — Design Ref: §3.3 예측, §3.4 신뢰구간
  forecast(serviceId: string, horizonDays: number): ForecastPoint[] {
    const points = this.series.get(serviceId) ?? []
    if (points.length === 0) return []

    const decomp = this.decompose(serviceId)
    const lastTrend = decomp.trend[decomp.trend.length - 1] ?? 0
    const residualStd = this.standardDeviation(decomp.residual)
    const interval = 1.5 * residualStd

    const serviceEvents = this.events.get(serviceId) ?? []
    const result: ForecastPoint[] = []
    const lastTs = points[points.length - 1]!.timestamp

    for (let d = 1; d <= horizonDays; d++) {
      const futureTs = lastTs + d * 86400000
      const futureDate = new Date(futureTs)
      const dateStr = futureDate.toISOString().slice(0, 10)
      const dow = futureDate.getDay()

      const seasonalFactor = this.getSeasonalFactor(decomp, serviceId, dow)
      const eventMultiplier = this.getEventMultiplier(serviceEvents, dateStr)
      const predicted = lastTrend * seasonalFactor * eventMultiplier

      result.push({
        date: dateStr,
        predicted: Math.max(0, predicted),
        lower: Math.max(0, predicted - interval),
        upper: predicted + interval,
      })
    }

    this.appendAudit('forecast', serviceId, { horizonDays, points: result.length })
    return result
  }

  // Plan SC: FR-R130.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private movingAverage(values: number[], window: number): number[] {
    return values.map((_, i) => {
      const start = Math.max(0, i - Math.floor(window / 2))
      const end = Math.min(values.length, start + window)
      const slice = values.slice(start, end)
      return slice.reduce((a, b) => a + b, 0) / slice.length
    })
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  private getSeasonalFactor(
    decomp: Decomposition,
    _serviceId: string,
    dow: number,
  ): number {
    const seasonalValues = decomp.seasonal.filter((_, i) => i % 7 === dow)
    if (seasonalValues.length === 0) return 1
    return seasonalValues.reduce((a, b) => a + b, 0) / seasonalValues.length
  }

  private getEventMultiplier(events: EventWeight[], dateStr: string): number {
    const event = events.find((e) => e.date === dateStr)
    return event?.multiplier ?? 1
  }

  private appendAudit(
    action: string,
    serviceId: string,
    detail: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      serviceId,
      detail,
    })
  }
}
