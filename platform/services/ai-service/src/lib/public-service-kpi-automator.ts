// Design Ref: §R295 — AI기반 공공 서비스 KPI 자동화
// Plan SC: SC-R295

export interface KpiDefinition {
  kpiId: string
  name: string
  unit: string
  target: number
  direction: 'UP' | 'DOWN'
  weight: number
}

export interface KpiMeasurement {
  kpiId: string
  value: number
  measuredAt: string
}

export interface KpiStatus {
  kpiId: string
  name: string
  currentValue: number
  target: number
  achievementRate: number
  status: 'ON_TRACK' | 'AT_RISK' | 'CRITICAL'
  trend: 'RISING' | 'FALLING' | 'FLAT'
}

export interface KpiReport {
  overallScore: number
  statuses: KpiStatus[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicServiceKpiAutomator {
  private kpis = new Map<string, KpiDefinition>()
  private measurements = new Map<string, KpiMeasurement[]>()
  private auditLog: AuditEntry[] = []

  registerKpi(kpi: KpiDefinition): void {
    this.kpis.set(kpi.kpiId, kpi)
    this.measurements.set(kpi.kpiId, [])
    this.auditLog.push({ action: 'kpi.register', timestamp: new Date().toISOString(), detail: kpi.kpiId })
  }

  recordMeasurement(measurement: KpiMeasurement): void {
    if (!this.kpis.has(measurement.kpiId)) {
      throw new Error(`KPI not found: ${measurement.kpiId}`)
    }
    const list = this.measurements.get(measurement.kpiId)!
    list.push(measurement)
    this.auditLog.push({ action: 'kpi.measure', timestamp: new Date().toISOString(), detail: measurement.kpiId })
  }

  analyze(): KpiReport {
    const statuses: KpiStatus[] = []
    let totalWeight = 0
    let weightedScore = 0

    for (const kpi of this.kpis.values()) {
      const records = this.measurements.get(kpi.kpiId) ?? []
      const currentValue = records.length > 0 ? (records[records.length - 1]?.value ?? 0) : 0

      let achievementRate: number
      if (kpi.direction === 'UP') {
        achievementRate = kpi.target > 0 ? (currentValue / kpi.target) * 100 : 0
      } else {
        achievementRate = kpi.target > 0 ? (kpi.target / Math.max(currentValue, 0.001)) * 100 : 0
      }
      achievementRate = Math.min(achievementRate, 100)

      let status: KpiStatus['status']
      if (achievementRate >= 100) {
        status = 'ON_TRACK'
      } else if (achievementRate >= 80) {
        status = 'AT_RISK'
      } else {
        status = 'CRITICAL'
      }

      const trend = this.computeTrend(records)

      statuses.push({ kpiId: kpi.kpiId, name: kpi.name, currentValue, target: kpi.target, achievementRate, status, trend })
      totalWeight += kpi.weight
      weightedScore += achievementRate * kpi.weight
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
    const recommendations = statuses
      .filter((s) => s.status === 'CRITICAL')
      .map((s) => `${s.name} KPI 달성률 ${s.achievementRate.toFixed(0)}% — 즉시 개선 필요`)

    this.auditLog.push({ action: 'kpi.analyze', timestamp: new Date().toISOString(), detail: `score=${overallScore}` })
    return { overallScore, statuses, recommendations }
  }

  private computeTrend(records: KpiMeasurement[]): KpiStatus['trend'] {
    if (records.length < 2) return 'FLAT'
    const recent = records.slice(-3)
    const first = recent[0]?.value ?? 0
    const last = recent[recent.length - 1]?.value ?? 0
    const delta = Math.abs(last - first) / (Math.abs(first) || 1)
    if (delta < 0.05) return 'FLAT'
    return last > first ? 'RISING' : 'FALLING'
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
