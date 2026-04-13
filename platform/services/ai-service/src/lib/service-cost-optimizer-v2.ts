// Design Ref: §R393 — AI기반 서비스 비용 최적화 엔진 v2
// Plan SC: SC-R393

export interface ServiceCostRecord {
  serviceId: string
  month: string
  computeCost: number
  storageCost: number
  networkCost: number
  licenseCost: number
  cpuUtilizationPercent: number
  memoryUtilizationPercent: number
}

export type OptimizationAction = 'RIGHTSIZE' | 'RESERVED_INSTANCE' | 'SPOT_INSTANCE' | 'STORAGE_TIER_DOWN' | 'LICENSE_CONSOLIDATION' | 'NO_ACTION'

export interface CostOptimizationRecommendation {
  serviceId: string
  action: OptimizationAction
  currentMonthlyCost: number
  estimatedSavingPercent: number
  estimatedSavingAmount: number
  rationale: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface CostOptimizationReport {
  analysisMonth: string
  totalCurrentCost: number
  totalEstimatedSaving: number
  savingPercent: number
  recommendations: CostOptimizationRecommendation[]
  topOpportunities: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ServiceCostOptimizerV2 {
  private costRecords = new Map<string, ServiceCostRecord[]>()
  private auditLog: AuditEntry[] = []

  recordCost(record: ServiceCostRecord): void {
    if (!this.costRecords.has(record.serviceId)) this.costRecords.set(record.serviceId, [])
    this.costRecords.get(record.serviceId)!.push(record)
    this.auditLog.push({ action: 'cost.record', timestamp: new Date().toISOString(), detail: `${record.serviceId}:${record.month}` })
  }

  optimize(analysisMonth: string): CostOptimizationReport {
    const recommendations: CostOptimizationRecommendation[] = []

    for (const [serviceId, records] of this.costRecords) {
      const monthRecord = records.find((r) => r.month === analysisMonth)
      if (!monthRecord) continue

      const totalCost = monthRecord.computeCost + monthRecord.storageCost + monthRecord.networkCost + monthRecord.licenseCost

      // 낮은 CPU/메모리 활용률 → 다운사이징
      if (monthRecord.cpuUtilizationPercent < 30 && monthRecord.memoryUtilizationPercent < 30) {
        recommendations.push({
          serviceId,
          action: 'RIGHTSIZE',
          currentMonthlyCost: totalCost,
          estimatedSavingPercent: 40,
          estimatedSavingAmount: Math.round(totalCost * 0.4),
          rationale: `CPU ${monthRecord.cpuUtilizationPercent}%, 메모리 ${monthRecord.memoryUtilizationPercent}% — 인스턴스 과다 할당`,
          priority: 'HIGH',
        })
      } else if (monthRecord.cpuUtilizationPercent < 50 && monthRecord.memoryUtilizationPercent < 50) {
        // 안정적 워크로드 + 중간 활용률 → 예약 인스턴스
        const historyCount = records.length
        if (historyCount >= 3) {
          recommendations.push({
            serviceId,
            action: 'RESERVED_INSTANCE',
            currentMonthlyCost: totalCost,
            estimatedSavingPercent: 30,
            estimatedSavingAmount: Math.round(totalCost * 0.3),
            rationale: '안정적 워크로드 패턴 감지 — 1년 예약 인스턴스 전환 권장',
            priority: 'MEDIUM',
          })
        }
      }

      // 스토리지 비용 높음 → 스토리지 등급 하향
      if (monthRecord.storageCost > monthRecord.computeCost * 0.5) {
        recommendations.push({
          serviceId,
          action: 'STORAGE_TIER_DOWN',
          currentMonthlyCost: totalCost,
          estimatedSavingPercent: 20,
          estimatedSavingAmount: Math.round(monthRecord.storageCost * 0.4),
          rationale: `스토리지 비용(${monthRecord.storageCost}) > 컴퓨트 50% — 콜드/아카이브 티어 전환`,
          priority: 'MEDIUM',
        })
      }

      // 라이선스 비용 높음 → 통합
      if (monthRecord.licenseCost > totalCost * 0.3) {
        recommendations.push({
          serviceId,
          action: 'LICENSE_CONSOLIDATION',
          currentMonthlyCost: totalCost,
          estimatedSavingPercent: 15,
          estimatedSavingAmount: Math.round(monthRecord.licenseCost * 0.3),
          rationale: `라이선스 비용 비중 ${Math.round(monthRecord.licenseCost / totalCost * 100)}% — 오픈소스 전환 또는 구독 통합 검토`,
          priority: 'LOW',
        })
      }

      // 추천 없음
      if (!recommendations.some((r) => r.serviceId === serviceId)) {
        recommendations.push({
          serviceId,
          action: 'NO_ACTION',
          currentMonthlyCost: totalCost,
          estimatedSavingPercent: 0,
          estimatedSavingAmount: 0,
          rationale: '현재 비용 구조 최적화 상태',
          priority: 'LOW',
        })
      }
    }

    const totalCurrentCost = recommendations.reduce((s, r) => s + r.currentMonthlyCost, 0)
    const totalEstimatedSaving = recommendations.reduce((s, r) => s + r.estimatedSavingAmount, 0)
    const savingPercent = totalCurrentCost > 0 ? Math.round(totalEstimatedSaving / totalCurrentCost * 100) : 0

    const topOpportunities = recommendations
      .filter((r) => r.action !== 'NO_ACTION')
      .sort((a, b) => b.estimatedSavingAmount - a.estimatedSavingAmount)
      .slice(0, 3)
      .map((r) => `${r.serviceId}: ${r.action} — ${r.estimatedSavingAmount.toLocaleString()}원 절감`)

    this.auditLog.push({ action: 'cost.optimize', timestamp: new Date().toISOString(), detail: `${analysisMonth}:saving=${savingPercent}%` })
    return {
      analysisMonth,
      totalCurrentCost,
      totalEstimatedSaving,
      savingPercent,
      recommendations,
      topOpportunities,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
