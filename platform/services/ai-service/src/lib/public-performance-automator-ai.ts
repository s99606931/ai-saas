// Design Ref: §R364 — AI기반 공공기관 성과 측정 자동화
// Plan SC: SC-R364

export interface PerformanceIndicator {
  indicatorId: string
  name: string
  targetValue: number
  weight: number
  higherIsBetter: boolean
}

export interface PerformanceMeasurement {
  orgId: string
  indicatorId: string
  period: string
  actualValue: number
}

export type PerformanceGrade = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'FAIL'

export interface OrgPerformanceReport {
  orgId: string
  period: string
  compositeScore: number
  grade: PerformanceGrade
  indicatorResults: {
    indicatorId: string
    name: string
    targetValue: number
    actualValue: number
    achievementRate: number
    weightedScore: number
  }[]
  recommendations: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicPerformanceAutomatorAi {
  private indicators = new Map<string, PerformanceIndicator>()
  private measurements: PerformanceMeasurement[] = []
  private auditLog: AuditEntry[] = []

  registerIndicator(indicator: PerformanceIndicator): void {
    this.indicators.set(indicator.indicatorId, indicator)
    this.auditLog.push({ action: 'indicator.register', timestamp: new Date().toISOString(), detail: indicator.indicatorId })
  }

  recordMeasurement(measurement: PerformanceMeasurement): void {
    this.measurements.push(measurement)
    this.auditLog.push({ action: 'measurement.record', timestamp: new Date().toISOString(), detail: `${measurement.orgId}:${measurement.indicatorId}` })
  }

  evaluate(orgId: string, period: string): OrgPerformanceReport {
    const orgMeasurements = this.measurements.filter((m) => m.orgId === orgId && m.period === period)

    const indicatorResults = []
    let totalWeight = 0
    let weightedSum = 0

    for (const [, indicator] of this.indicators) {
      const measurement = orgMeasurements.find((m) => m.indicatorId === indicator.indicatorId)
      const actualValue = measurement?.actualValue ?? 0

      const achievementRate = indicator.targetValue > 0
        ? indicator.higherIsBetter
          ? actualValue / indicator.targetValue
          : indicator.targetValue / Math.max(actualValue, 0.001)
        : 0

      const clampedRate = Math.min(1.2, Math.max(0, achievementRate))
      const weightedScore = clampedRate * indicator.weight

      totalWeight += indicator.weight
      weightedSum += weightedScore

      indicatorResults.push({
        indicatorId: indicator.indicatorId,
        name: indicator.name,
        targetValue: indicator.targetValue,
        actualValue,
        achievementRate: Math.round(clampedRate * 100) / 100,
        weightedScore: Math.round(weightedScore * 100) / 100,
      })
    }

    const compositeScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0

    let grade: PerformanceGrade
    if (compositeScore >= 95) grade = 'EXCELLENT'
    else if (compositeScore >= 80) grade = 'GOOD'
    else if (compositeScore >= 60) grade = 'AVERAGE'
    else if (compositeScore >= 40) grade = 'POOR'
    else grade = 'FAIL'

    const recommendations: string[] = []
    const poorIndicators = indicatorResults.filter((r) => r.achievementRate < 0.6)
    if (poorIndicators.length > 0) {
      recommendations.push(`미달 지표 ${poorIndicators.map((r) => r.name).join(', ')} — 개선 계획 수립 필요`)
    }
    if (grade === 'FAIL') recommendations.push('종합 성과 40점 미만 — 기관 성과 관리 강화 필요')

    this.auditLog.push({ action: 'performance.evaluate', timestamp: new Date().toISOString(), detail: `${orgId}:${grade}` })
    return { orgId, period, compositeScore, grade, indicatorResults, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
