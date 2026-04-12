/**
 * AI 기반 인프라 비용 예측기 — SVC-AI-ADV-R127
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R127/SVC-AI-ADV-R127.design.md
 * Plan SC: FR-R127.1 ~ FR-R127.6
 *
 * k8s 리소스 사용량 기반 월별 인프라 비용 예측.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type ResourceType = 'cpu' | 'memory' | 'storage' | 'network' | 'gpu'

export interface ResourceUsage {
  timestamp: string
  namespace: string
  resourceType: ResourceType
  usedAmount: number   // millicores for cpu, MiB for memory, GiB for storage/network
  requestedAmount: number
  limitAmount: number
  grade: DataGrade
}

export interface CostRate {
  resourceType: ResourceType
  unitCostPerHour: number  // KRW per unit per hour
  unit: string
}

export interface ResourceForecast {
  resourceType: ResourceType
  namespace: string
  avgUsage: number
  peakUsage: number
  trend: 'increasing' | 'stable' | 'decreasing'
  projectedMonthly: number  // KRW
  confidencePercent: number
}

export interface InfraCostReport {
  generatedAt: string
  period: { from: string; to: string }
  forecasts: ResourceForecast[]
  totalProjectedMonthlyKrw: number
  anomalies: Array<{ namespace: string; resourceType: ResourceType; reason: string }>
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R127.2 — default cost rates (public cloud reference, KRW)
const DEFAULT_RATES: CostRate[] = [
  { resourceType: 'cpu', unitCostPerHour: 20, unit: '1000m (1 core)' },
  { resourceType: 'memory', unitCostPerHour: 2, unit: '1 GiB' },
  { resourceType: 'storage', unitCostPerHour: 0.5, unit: '1 GiB' },
  { resourceType: 'network', unitCostPerHour: 10, unit: '1 GiB egress' },
  { resourceType: 'gpu', unitCostPerHour: 500, unit: '1 GPU' },
]

const HOURS_PER_MONTH = 730

export class InfraCostPredictor {
  private readonly usageData: ResourceUsage[] = []
  private readonly rates = new Map<ResourceType, CostRate>()
  private readonly auditLog: AuditEntry[] = []

  constructor() {
    for (const rate of DEFAULT_RATES) {
      this.rates.set(rate.resourceType, rate)
    }
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R127.3
  setCostRate(rate: CostRate): void {
    this.rates.set(rate.resourceType, rate)
    this.audit('setCostRate', { resourceType: rate.resourceType, unitCostPerHour: rate.unitCostPerHour })
  }

  // Plan SC: FR-R127.1
  addUsage(usage: ResourceUsage): void {
    if (usage.grade === DataGrade.C || usage.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${usage.grade}등급 리소스 데이터 수집 금지 (N2SF N-05)`)
    }
    this.usageData.push(usage)
    this.audit('addUsage', { namespace: usage.namespace, resourceType: usage.resourceType })
  }

  // Plan SC: FR-R127.4 — trend from usage sequence (simple linear slope sign)
  private detectTrend(values: number[]): ResourceForecast['trend'] {
    if (values.length < 3) return 'stable'
    const n = values.length
    const mid = Math.floor(n / 2)
    const firstHalf = values.slice(0, mid).reduce((s, v) => s + v, 0) / mid
    const secondHalf = values.slice(mid).reduce((s, v) => s + v, 0) / (n - mid)
    const delta = secondHalf - firstHalf
    const threshold = firstHalf * 0.05
    if (delta > threshold) return 'increasing'
    if (delta < -threshold) return 'decreasing'
    return 'stable'
  }

  // Plan SC: FR-R127.5
  private detectAnomalies(
    grouped: Map<string, Map<ResourceType, number[]>>,
  ): InfraCostReport['anomalies'] {
    const anomalies: InfraCostReport['anomalies'] = []
    for (const [ns, typeMap] of grouped.entries()) {
      for (const [rt, values] of typeMap.entries()) {
        const avg = values.reduce((s, v) => s + v, 0) / values.length
        const stddev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length)
        const peak = Math.max(...values)
        if (stddev > avg * 0.5 && peak > avg * 2) {
          anomalies.push({ namespace: ns, resourceType: rt, reason: `피크=${peak.toFixed(0)}, 평균=${avg.toFixed(0)}, 표준편차=${stddev.toFixed(0)}` })
        }
      }
    }
    return anomalies
  }

  // Plan SC: FR-R127.6
  forecast(from: string, to: string): InfraCostReport {
    if (this.usageData.length === 0) {
      throw new Error('사용량 데이터가 없습니다')
    }

    // Group by namespace + resourceType
    const grouped = new Map<string, Map<ResourceType, number[]>>()
    for (const u of this.usageData) {
      if (!grouped.has(u.namespace)) grouped.set(u.namespace, new Map())
      const typeMap = grouped.get(u.namespace)!
      if (!typeMap.has(u.resourceType)) typeMap.set(u.resourceType, [])
      typeMap.get(u.resourceType)!.push(u.usedAmount)
    }

    const forecasts: ResourceForecast[] = []
    for (const [ns, typeMap] of grouped.entries()) {
      for (const [rt, values] of typeMap.entries()) {
        const avg = values.reduce((s, v) => s + v, 0) / values.length
        const peak = Math.max(...values)
        const trend = this.detectTrend(values)
        const trendMultiplier = trend === 'increasing' ? 1.15 : trend === 'decreasing' ? 0.90 : 1.0
        const projected = avg * trendMultiplier
        const rate = this.rates.get(rt)
        const projectedMonthly = rate
          ? Math.round(projected * rate.unitCostPerHour * HOURS_PER_MONTH)
          : 0
        const confidencePercent = Math.max(50, Math.min(95, 100 - Math.round((peak - avg) / (avg || 1) * 20)))
        forecasts.push({ resourceType: rt, namespace: ns, avgUsage: Math.round(avg * 100) / 100, peakUsage: peak, trend, projectedMonthly, confidencePercent })
      }
    }

    const totalProjectedMonthlyKrw = forecasts.reduce((s, f) => s + f.projectedMonthly, 0)
    const anomalies = this.detectAnomalies(grouped)
    this.audit('forecast', { forecastCount: forecasts.length, totalProjectedMonthlyKrw })
    return { generatedAt: new Date().toISOString(), period: { from, to }, forecasts, totalProjectedMonthlyKrw, anomalies }
  }
}
