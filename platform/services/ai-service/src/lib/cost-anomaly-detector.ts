/**
 * Cost Anomaly Detector — SVC-AI-ADV-R130
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R130.design.md
 * Plan SC: FR-R130.1 ~ FR-R130.7
 *
 * AI 비용 이상 감지 — Z-score + IQR + rate-of-change 3지표 앙상블.
 * cool-down 기반 중복 알람 억제.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface CostPoint {
  tenantId: string
  timestamp: number
  cost: number
}

export interface DetectorOptions {
  windowSize?: number
  zThreshold?: number
  iqrMultiplier?: number
  rateThreshold?: number
  coolDownMs?: number
}

export type AnomalySeverity = 'normal' | 'warning' | 'critical'

export interface AnomalyReport {
  tenantId: string
  timestamp: number
  cost: number
  zScore: number
  iqrBoundary: number
  rateOfChange: number
  severity: AnomalySeverity
  reasons: string[]
}

export interface AnomalyAuditEntry {
  action: 'recorded' | 'detected' | 'alertEmitted' | 'coolDownSuppressed'
  tenantId: string
  timestamp: number
  details: Record<string, unknown>
}

export class CostAnomalyDetector {
  private readonly windowSize: number
  private readonly zThreshold: number
  private readonly iqrMultiplier: number
  private readonly rateThreshold: number
  private readonly coolDownMs: number
  private readonly epsilon = 1e-9

  private readonly windows = new Map<string, CostPoint[]>()
  private readonly lastAlertAt = new Map<string, number>()
  private readonly listeners: Array<(r: AnomalyReport) => void> = []
  private readonly auditLog: AnomalyAuditEntry[] = []

  constructor(grade: DataGrade, options: DetectorOptions = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 Cost Anomaly Detector 사용 금지 (N2SF N-05)`,
      )
    }
    this.windowSize = options.windowSize ?? 30
    this.zThreshold = options.zThreshold ?? 3.0
    this.iqrMultiplier = options.iqrMultiplier ?? 1.5
    this.rateThreshold = options.rateThreshold ?? 2.0
    this.coolDownMs = options.coolDownMs ?? 5 * 60 * 1000

    if (this.windowSize < 3) {
      throw new Error('windowSize must be >= 3')
    }
  }

  /** FR-R130.1 */
  record(point: CostPoint): void {
    if (!point.tenantId.trim()) {
      throw new Error('tenantId must not be empty')
    }
    if (!Number.isFinite(point.cost) || point.cost < 0) {
      throw new Error('cost must be non-negative finite number')
    }
    const arr = this.windows.get(point.tenantId) ?? []
    arr.push({ ...point })
    if (arr.length > this.windowSize) arr.shift()
    this.windows.set(point.tenantId, arr)

    this.audit({
      action: 'recorded',
      tenantId: point.tenantId,
      timestamp: Date.now(),
      details: { cost: point.cost, windowLen: arr.length },
    })
  }

  /** FR-R130.5 */
  detect(tenantId: string): AnomalyReport {
    const arr = this.windows.get(tenantId) ?? []
    const latest = arr[arr.length - 1]
    if (!latest) {
      throw new Error(`no data for tenant: ${tenantId}`)
    }

    const reasons: string[] = []
    let zScore = 0
    let iqrBoundary = 0
    let rate = 0

    if (arr.length >= 3) {
      const costs = arr.map((p) => p.cost)
      zScore = this.computeZ(costs)
      if (Math.abs(zScore) > this.zThreshold) reasons.push('z-score')

      iqrBoundary = this.computeIQRBoundary(costs)
      if (latest.cost > iqrBoundary) reasons.push('iqr-outlier')

      if (arr.length >= 2) {
        const prev = arr[arr.length - 2]
        if (prev) {
          rate = latest.cost / (prev.cost + this.epsilon)
          if (rate > this.rateThreshold) reasons.push('rate-spike')
        }
      }
    }

    let severity: AnomalySeverity = 'normal'
    if (reasons.length >= 2) severity = 'critical'
    else if (reasons.length === 1) severity = 'warning'

    const report: AnomalyReport = {
      tenantId,
      timestamp: latest.timestamp,
      cost: latest.cost,
      zScore,
      iqrBoundary,
      rateOfChange: rate,
      severity,
      reasons,
    }

    this.audit({
      action: 'detected',
      tenantId,
      timestamp: Date.now(),
      details: { severity, reasons },
    })

    if (severity === 'critical') {
      const last = this.lastAlertAt.get(tenantId) ?? 0
      const now = Date.now()
      if (now - last < this.coolDownMs) {
        this.audit({
          action: 'coolDownSuppressed',
          tenantId,
          timestamp: now,
          details: { remainingMs: this.coolDownMs - (now - last) },
        })
      } else {
        this.lastAlertAt.set(tenantId, now)
        for (const l of this.listeners) l(report)
        this.audit({
          action: 'alertEmitted',
          tenantId,
          timestamp: now,
          details: { severity, reasons },
        })
      }
    }

    return report
  }

  /** FR-R130.6 */
  onAnomaly(listener: (r: AnomalyReport) => void): void {
    this.listeners.push(listener)
  }

  /** FR-R130.7 */
  getAuditLog(): AnomalyAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private computeZ(costs: number[]): number {
    const n = costs.length
    const mean = costs.reduce((a, b) => a + b, 0) / n
    const variance = costs.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const std = Math.sqrt(variance)
    const latest = costs[n - 1] ?? 0
    return (latest - mean) / (std + this.epsilon)
  }

  private computeIQRBoundary(costs: number[]): number {
    const sorted = [...costs].sort((a, b) => a - b)
    const q1 = this.quantile(sorted, 0.25)
    const q3 = this.quantile(sorted, 0.75)
    const iqr = q3 - q1
    return q3 + this.iqrMultiplier * iqr
  }

  private quantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0
    const pos = (sorted.length - 1) * q
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const loVal = sorted[lo] ?? 0
    const hiVal = sorted[hi] ?? 0
    if (lo === hi) return loVal
    return loVal + (hiVal - loVal) * (pos - lo)
  }

  private audit(entry: AnomalyAuditEntry): void {
    this.auditLog.push(entry)
  }
}
