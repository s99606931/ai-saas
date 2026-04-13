// Design Ref: §R365 — AI기반 멀티클라우드 비용 예측
// Plan SC: SC-R365

export interface CloudResource {
  resourceId: string
  provider: 'AWS' | 'AZURE' | 'GCP' | 'NCP'
  resourceType: string
  region: string
  monthlyCost: number
  usagePercent: number
}

export interface CostHistory {
  month: string
  totalCost: number
  byProvider: Record<string, number>
}

export interface CostPrediction {
  targetMonth: string
  predictedTotalCost: number
  predictedByProvider: Record<string, number>
  costTrend: 'INCREASING' | 'STABLE' | 'DECREASING'
  savingOpportunities: { resourceId: string; potentialSaving: number; reason: string }[]
  totalPotentialSaving: number
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class MulticloudCostPredictorAi {
  private resources = new Map<string, CloudResource>()
  private histories: CostHistory[] = []
  private auditLog: AuditEntry[] = []

  registerResource(resource: CloudResource): void {
    this.resources.set(resource.resourceId, resource)
    this.auditLog.push({ action: 'resource.register', timestamp: new Date().toISOString(), detail: resource.resourceId })
  }

  recordHistory(history: CostHistory): void {
    this.histories.push(history)
    this.auditLog.push({ action: 'cost.record', timestamp: new Date().toISOString(), detail: history.month })
  }

  predict(targetMonth: string): CostPrediction {
    const currentTotalCost = Array.from(this.resources.values()).reduce((s, r) => s + r.monthlyCost, 0)

    // 트렌드 분석
    let costTrend: CostPrediction['costTrend'] = 'STABLE'
    if (this.histories.length >= 2) {
      const half = Math.floor(this.histories.length / 2)
      const recentAvg = this.histories.slice(half).reduce((s, h) => s + h.totalCost, 0) / (this.histories.length - half)
      const oldAvg = this.histories.slice(0, half).reduce((s, h) => s + h.totalCost, 0) / half
      if (recentAvg > oldAvg * 1.05) costTrend = 'INCREASING'
      else if (recentAvg < oldAvg * 0.95) costTrend = 'DECREASING'
    }

    // 예측 비용: 트렌드 반영
    const trendFactor = costTrend === 'INCREASING' ? 1.1 : costTrend === 'DECREASING' ? 0.95 : 1.0
    const predictedTotalCost = Math.round(currentTotalCost * trendFactor)

    // 제공자별 예측
    const predictedByProvider: Record<string, number> = {}
    for (const resource of this.resources.values()) {
      predictedByProvider[resource.provider] = (predictedByProvider[resource.provider] ?? 0) + Math.round(resource.monthlyCost * trendFactor)
    }

    // 절감 기회: 사용률 50% 미만 리소스
    const savingOpportunities = Array.from(this.resources.values())
      .filter((r) => r.usagePercent < 50)
      .map((r) => ({
        resourceId: r.resourceId,
        potentialSaving: Math.round(r.monthlyCost * 0.3),
        reason: `사용률 ${r.usagePercent}% — 다운사이징 또는 예약 인스턴스 전환 권고`,
      }))

    const totalPotentialSaving = savingOpportunities.reduce((s, o) => s + o.potentialSaving, 0)

    const recommendations: string[] = []
    if (costTrend === 'INCREASING') recommendations.push('비용 증가 추세 — 리소스 사용 최적화 검토')
    if (totalPotentialSaving > 0) recommendations.push(`저활용 리소스 최적화 시 월 ${totalPotentialSaving.toLocaleString()}원 절감 가능`)

    this.auditLog.push({ action: 'cost.predict', timestamp: new Date().toISOString(), detail: `${targetMonth}:${costTrend}` })
    return { targetMonth, predictedTotalCost, predictedByProvider, costTrend, savingOpportunities, totalPotentialSaving, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
