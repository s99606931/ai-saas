/**
 * AI 기반 장애 예측 엔진 v2 — SVC-AI-ADV-R183
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R183/SVC-AI-ADV-R183.design.md
 * Plan SC: FR-R183.1 ~ FR-R183.5
 *
 * 메트릭 시계열 이상 탐지 + 장애 예측 + 경보 레벨 결정.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface MetricDefinition {
  id: string
  name: string
  normalMin: number
  normalMax: number
  unit: string
}

export interface MetricReading {
  metricId: string
  value: number
  timestamp: number
}

export type AlertLevel = 'normal' | 'warning' | 'critical'

export interface AnomalyDetail {
  metricId: string
  metricName: string
  currentValue: number
  mean: number
  stddev: number
  zScore: number
}

export interface PredictionReport {
  predictionScore: number
  alertLevel: AlertLevel
  anomalies: AnomalyDetail[]
  totalMetrics: number
  anomalyCount: number
  predictedAt: number
}

export interface FPEAuditEntry {
  action: 'metricRegistered' | 'readingRecorded' | 'predicted'
  timestamp: number
  details: Record<string, unknown>
}

export class FailurePredictionEngineV2 {
  private readonly metrics = new Map<string, MetricDefinition>()
  private readonly readings = new Map<string, MetricReading[]>()
  private readonly windowSize: number
  private readonly auditLog: FPEAuditEntry[] = []

  constructor(grade: DataGrade, options: { windowSize?: number } = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 장애 예측 엔진 사용 금지 (N2SF N-05)`,
      )
    }
    this.windowSize = options.windowSize ?? 20
  }

  /** FR-R183.1 */
  registerMetric(def: MetricDefinition): void {
    if (!def.id.trim()) throw new Error('metric id must not be empty')
    this.metrics.set(def.id, { ...def })
    this.audit('metricRegistered', { id: def.id, name: def.name })
  }

  /** FR-R183.2 */
  recordReading(reading: MetricReading): void {
    if (!this.metrics.has(reading.metricId)) {
      throw new Error(`unknown metric: ${reading.metricId}`)
    }
    const arr = this.readings.get(reading.metricId) ?? []
    arr.push({ ...reading })
    this.readings.set(reading.metricId, arr)
    this.audit('readingRecorded', { metricId: reading.metricId, value: reading.value })
  }

  /** FR-R183.3 ~ FR-R183.4 */
  predict(): PredictionReport {
    const anomalies: AnomalyDetail[] = []
    let totalMetrics = 0

    for (const [metricId, allReadings] of this.readings.entries()) {
      const def = this.metrics.get(metricId)
      if (!def || allReadings.length === 0) continue
      totalMetrics++

      const window = allReadings.slice(-this.windowSize)
      const values = window.map((r) => r.value)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
      const stddev = Math.sqrt(variance)

      const latest = values[values.length - 1] ?? mean
      const zScore = stddev > 0 ? Math.abs((latest - mean) / stddev) : 0

      if (zScore > 2.0 || latest < def.normalMin || latest > def.normalMax) {
        anomalies.push({ metricId, metricName: def.name, currentValue: latest, mean, stddev, zScore })
      }
    }

    const predictionScore = totalMetrics > 0 ? anomalies.length / totalMetrics : 0
    const alertLevel: AlertLevel =
      predictionScore >= 0.7 ? 'critical' : predictionScore >= 0.4 ? 'warning' : 'normal'

    const report: PredictionReport = {
      predictionScore,
      alertLevel,
      anomalies,
      totalMetrics,
      anomalyCount: anomalies.length,
      predictedAt: Date.now(),
    }

    this.audit('predicted', { alertLevel, anomalies: anomalies.length, score: predictionScore })
    return report
  }

  /** FR-R183.5 */
  getAuditLog(): readonly FPEAuditEntry[] {
    return [...this.auditLog]
  }

  private audit(action: FPEAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
