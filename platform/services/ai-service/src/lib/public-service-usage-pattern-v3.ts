// Design Ref: §R614 — AI기반 공공 서비스 이용 패턴 v3
// Plan SC: SVC-AI-ADV-R614-SC01

export type PeakLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface UsageRecord {
  recordId: string
  serviceId: string
  agencyId: string
  hourOfDay: number  // 0..23
  dayOfWeek: number  // 0..6 (0=Sunday)
  requestCount: number
  recordedAt: string
}

export interface PeakPeriod {
  hourOfDay: number
  dayOfWeek: number
  avgRequestCount: number
  peakLevel: PeakLevel
}

export interface CapacityPrediction {
  serviceId: string
  currentPeakRequests: number
  predictedCapacity: number  // peak × 1.3
  recommendedInstances: number
}

export interface UsageReport {
  totalRecords: number
  serviceCount: number
  agencyCount: number
  topServices: { serviceId: string; totalRequests: number }[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class PublicServiceUsagePatternV3 {
  private records: UsageRecord[] = []
  private auditLog: AuditEntry[] = []

  recordUsage(record: UsageRecord): void {
    this.records.push(record)
    this.appendAudit('usage.record', record.serviceId, { agencyId: record.agencyId, requestCount: record.requestCount })
  }

  analyzePeaks(serviceId: string): PeakPeriod[] {
    const serviceRecords = this.records.filter((r) => r.serviceId === serviceId)
    if (serviceRecords.length === 0) return []

    const buckets = new Map<string, { total: number; count: number }>()
    for (const r of serviceRecords) {
      const key = `${r.hourOfDay}-${r.dayOfWeek}`
      const existing = buckets.get(key) ?? { total: 0, count: 0 }
      buckets.set(key, { total: existing.total + r.requestCount, count: existing.count + 1 })
    }

    const allAvgs = Array.from(buckets.values()).map((b) => b.total / b.count)
    const maxAvg = allAvgs.length > 0 ? Math.max(...allAvgs) : 0
    const highThreshold = maxAvg * 0.7
    const medThreshold = maxAvg * 0.4

    const peaks: PeakPeriod[] = []
    for (const [key, bucket] of buckets) {
      const parts = key.split('-')
      const hourStr = parts[0]
      const dayStr = parts[1]
      if (hourStr === undefined || dayStr === undefined) continue

      const hourOfDay = parseInt(hourStr, 10)
      const dayOfWeek = parseInt(dayStr, 10)
      const avgRequestCount = Math.round(bucket.total / bucket.count)
      const peakLevel: PeakLevel = avgRequestCount >= highThreshold ? 'HIGH' : avgRequestCount >= medThreshold ? 'MEDIUM' : 'LOW'
      peaks.push({ hourOfDay, dayOfWeek, avgRequestCount, peakLevel })
    }

    this.appendAudit('usage.analyzePeaks', serviceId, { peakCount: peaks.length })
    return peaks.sort((a, b) => b.avgRequestCount - a.avgRequestCount)
  }

  predictCapacity(serviceId: string): CapacityPrediction {
    const peaks = this.analyzePeaks(serviceId)
    const topPeak = peaks[0]
    const currentPeakRequests = topPeak ? topPeak.avgRequestCount : 0
    const predictedCapacity = Math.ceil(currentPeakRequests * 1.3)
    const recommendedInstances = Math.max(1, Math.ceil(predictedCapacity / 1000))

    this.appendAudit('usage.predictCapacity', serviceId, { currentPeakRequests, predictedCapacity })
    return { serviceId, currentPeakRequests, predictedCapacity, recommendedInstances }
  }

  generateReport(): UsageReport {
    const serviceIds = new Set(this.records.map((r) => r.serviceId))
    const agencyIds = new Set(this.records.map((r) => r.agencyId))

    const serviceTotals = new Map<string, number>()
    for (const r of this.records) {
      serviceTotals.set(r.serviceId, (serviceTotals.get(r.serviceId) ?? 0) + r.requestCount)
    }

    const topServices = Array.from(serviceTotals.entries())
      .map(([serviceId, totalRequests]) => ({ serviceId, totalRequests }))
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 5)

    this.appendAudit('report.generate', 'system', { totalRecords: this.records.length, serviceCount: serviceIds.size })
    return {
      totalRecords: this.records.length,
      serviceCount: serviceIds.size,
      agencyCount: agencyIds.size,
      topServices,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
