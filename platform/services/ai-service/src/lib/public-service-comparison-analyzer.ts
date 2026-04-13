// Design Ref: §R320 — AI기반 공공기관 서비스 비교 분석
// Plan SC: SC-R320

export interface ServiceMetrics {
  serviceId: string
  serviceName: string
  orgName: string
  uptimePercent: number
  avgResponseMs: number
  userSatisfactionScore: number
  costPerTransaction: number
  monthlyActiveUsers: number
  complianceScore: number
}

export interface ComparisonDimension {
  dimensionId: string
  name: string
  metricField: keyof ServiceMetrics
  higherIsBetter: boolean
  weight: number
}

export interface ServiceRanking {
  rank: number
  serviceId: string
  serviceName: string
  orgName: string
  compositeScore: number
  dimensionScores: { dimensionId: string; name: string; score: number; percentile: number }[]
  strengths: string[]
  weaknesses: string[]
}

export interface ComparisonReport {
  rankings: ServiceRanking[]
  bestInClass: Record<string, string>
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicServiceComparisonAnalyzer {
  private services = new Map<string, ServiceMetrics>()
  private dimensions: ComparisonDimension[] = []
  private auditLog: AuditEntry[] = []

  registerService(service: ServiceMetrics): void {
    this.services.set(service.serviceId, service)
    this.auditLog.push({ action: 'service.register', timestamp: new Date().toISOString(), detail: service.serviceId })
  }

  registerDimension(dimension: ComparisonDimension): void {
    this.dimensions.push(dimension)
    this.auditLog.push({ action: 'dimension.register', timestamp: new Date().toISOString(), detail: dimension.dimensionId })
  }

  compare(): ComparisonReport {
    const serviceList = Array.from(this.services.values())
    if (serviceList.length === 0) return { rankings: [], bestInClass: {} }

    const rankings: ServiceRanking[] = []
    const bestInClass: Record<string, string> = {}

    for (const svc of serviceList) {
      const dimensionScores: ServiceRanking['dimensionScores'] = []
      const strengths: string[] = []
      const weaknesses: string[] = []
      let compositeScore = 0
      let totalWeight = 0

      for (const dim of this.dimensions) {
        const values = serviceList.map((s) => Number(s[dim.metricField]) || 0)
        const min = Math.min(...values)
        const max = Math.max(...values)
        const raw = Number(svc[dim.metricField]) || 0
        const range = max - min

        let normalized = range > 0 ? (raw - min) / range : 0
        if (!dim.higherIsBetter) normalized = 1 - normalized
        const score = Math.round(normalized * 100)

        // Percentile: how many services this one beats
        const beatenCount = values.filter((v) => (dim.higherIsBetter ? v < raw : v > raw)).length
        const percentile = Math.round((beatenCount / serviceList.length) * 100)

        dimensionScores.push({ dimensionId: dim.dimensionId, name: dim.name, score, percentile })
        compositeScore += score * dim.weight
        totalWeight += dim.weight

        if (percentile >= 75) strengths.push(dim.name)
        else if (percentile <= 25) weaknesses.push(dim.name)
      }

      compositeScore = totalWeight > 0 ? Math.round(compositeScore / totalWeight) : 0
      rankings.push({ rank: 0, serviceId: svc.serviceId, serviceName: svc.serviceName, orgName: svc.orgName, compositeScore, dimensionScores, strengths, weaknesses })
    }

    // Sort by composite score
    rankings.sort((a, b) => b.compositeScore - a.compositeScore)
    rankings.forEach((r, i) => { r.rank = i + 1 })

    // Best in class per dimension
    for (const dim of this.dimensions) {
      const best = serviceList.reduce((prev, curr) => {
        const prevVal = Number(prev[dim.metricField]) || 0
        const currVal = Number(curr[dim.metricField]) || 0
        return (dim.higherIsBetter ? currVal > prevVal : currVal < prevVal) ? curr : prev
      })
      bestInClass[dim.name] = best.serviceName
    }

    this.auditLog.push({ action: 'service.compare', timestamp: new Date().toISOString(), detail: `services=${rankings.length}` })
    return { rankings, bestInClass }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
