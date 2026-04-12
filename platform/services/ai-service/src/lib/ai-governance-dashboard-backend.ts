/**
 * AI Governance Dashboard Backend — SVC-AI-ADV-R115
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R115.design.md
 * Plan SC: FR-R115.1 ~ FR-R115.8
 *
 * AI 거버넌스 KPI 집계 + 대시보드 API.
 * CSAP D-06 감사, D-08 RBAC, N2SF C/S 마스킹.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type MetricCategory =
  | 'safety'
  | 'accuracy'
  | 'utilization'
  | 'cost'

export type Resolution = 'minute' | 'hour' | 'day'
export type Role = 'admin' | 'auditor' | 'viewer'

export interface MetricInput {
  category: MetricCategory
  name: string
  value: number
  grade: DataGrade
  tags?: Record<string, string>
}

export interface MetricPoint {
  timestamp: number
  value: number
  count: number
}

export interface MetricSummary {
  latest: number
  avg: number
  count: number
}

export interface Snapshot {
  category: MetricCategory
  metrics: Record<string, MetricSummary>
}

export interface Alert {
  metricName: string
  value: number
  threshold: number
  timestamp: number
}

export interface TimeseriesQuery {
  category: MetricCategory
  name: string
  from: number
  to: number
  resolution: Resolution
}

export interface DashboardOptions {
  thresholds?: Record<string, number>
  role?: Role
}

export interface GovernanceAuditEntry {
  timestamp: string
  action:
    | 'record'
    | 'query'
    | 'snapshot'
    | 'alert'
    | 'gradeMasked'
    | 'rbacDenied'
  detail?: Record<string, unknown>
}

const ROLE_ALLOWED: Record<Role, MetricCategory[]> = {
  viewer: ['safety', 'accuracy'],
  auditor: ['safety', 'accuracy', 'cost'],
  admin: ['safety', 'accuracy', 'cost', 'utilization'],
}

const RESOLUTION_MS: Record<Resolution, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
}

export class AIGovernanceDashboardBackend {
  private readonly data = new Map<
    MetricCategory,
    Map<string, MetricPoint[]>
  >()
  private readonly thresholds: Record<string, number>
  private readonly role: Role
  private readonly alerts: Alert[] = []
  private readonly auditLog: GovernanceAuditEntry[] = []

  constructor(options: DashboardOptions = {}) {
    this.thresholds = options.thresholds ?? {}
    this.role = options.role ?? 'viewer'
  }

  getAuditLog(): readonly GovernanceAuditEntry[] {
    return this.auditLog
  }

  getAlerts(): readonly Alert[] {
    return this.alerts
  }

  private audit(
    action: GovernanceAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R115.1: 지표 기록. C/S 등급은 마스킹(기록하지 않음).
   */
  recordMetric(input: MetricInput, now: number = Date.now()): boolean {
    if (input.grade === DataGrade.C || input.grade === DataGrade.S) {
      this.audit('gradeMasked', {
        category: input.category,
        name: input.name,
        grade: input.grade,
      })
      return false
    }

    const categoryMap =
      this.data.get(input.category) ?? new Map<string, MetricPoint[]>()
    const series = categoryMap.get(input.name) ?? []
    series.push({
      timestamp: now,
      value: input.value,
      count: 1,
    })
    categoryMap.set(input.name, series)
    this.data.set(input.category, categoryMap)

    this.audit('record', {
      category: input.category,
      name: input.name,
      value: input.value,
    })

    this.checkThreshold(input.name, input.value, now)
    return true
  }

  /**
   * FR-R115.5: 경고 임계값 검사.
   */
  private checkThreshold(name: string, value: number, timestamp: number): void {
    const threshold = this.thresholds[name]
    if (threshold === undefined) return
    if (value > threshold) {
      const alert: Alert = { metricName: name, value, threshold, timestamp }
      this.alerts.push(alert)
      this.audit('alert', { ...alert })
    }
  }

  /**
   * FR-R115.6: RBAC 검사.
   */
  private hasAccess(category: MetricCategory): boolean {
    return ROLE_ALLOWED[this.role].includes(category)
  }

  /**
   * FR-R115.3: 시계열 조회.
   */
  queryTimeseries(q: TimeseriesQuery): MetricPoint[] {
    if (!this.hasAccess(q.category)) {
      this.audit('rbacDenied', { category: q.category, role: this.role })
      return []
    }
    const categoryMap = this.data.get(q.category)
    if (!categoryMap) return []
    const series = categoryMap.get(q.name) ?? []
    const filtered = series.filter(
      (p) => p.timestamp >= q.from && p.timestamp <= q.to,
    )
    const rolled = this.rollup(filtered, q.resolution)
    this.audit('query', {
      category: q.category,
      name: q.name,
      points: rolled.length,
    })
    return rolled
  }

  private rollup(points: MetricPoint[], resolution: Resolution): MetricPoint[] {
    if (points.length === 0) return []
    const bucketSize = RESOLUTION_MS[resolution]
    const buckets = new Map<number, MetricPoint>()
    for (const p of points) {
      const bucketKey = Math.floor(p.timestamp / bucketSize) * bucketSize
      const existing = buckets.get(bucketKey)
      if (existing) {
        const total = existing.count + p.count
        existing.value =
          (existing.value * existing.count + p.value * p.count) / total
        existing.count = total
      } else {
        buckets.set(bucketKey, {
          timestamp: bucketKey,
          value: p.value,
          count: p.count,
        })
      }
    }
    return Array.from(buckets.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }

  /**
   * FR-R115.4: 스냅샷 조회.
   */
  snapshot(category: MetricCategory): Snapshot {
    if (!this.hasAccess(category)) {
      this.audit('rbacDenied', { category, role: this.role })
      return { category, metrics: {} }
    }

    const categoryMap = this.data.get(category) ?? new Map()
    const metrics: Record<string, MetricSummary> = {}

    for (const [name, series] of categoryMap.entries()) {
      if (series.length === 0) continue
      const last = series[series.length - 1]
      if (!last) continue
      let sum = 0
      let totalCount = 0
      for (const p of series) {
        sum += p.value * p.count
        totalCount += p.count
      }
      metrics[name] = {
        latest: last.value,
        avg: totalCount > 0 ? sum / totalCount : 0,
        count: totalCount,
      }
    }

    this.audit('snapshot', { category, keys: Object.keys(metrics).length })

    return { category, metrics }
  }
}
