/**
 * AI 기반 멀티클라우드 비용 최적화 — SVC-AI-ADV-R179
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R179/SVC-AI-ADV-R179.design.md
 * Plan SC: FR-R179.1 ~ FR-R179.5
 *
 * 멀티클라우드 리소스 사용량 분석 + 비용 최적화 권고.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface CloudProvider {
  id: string
  name: string
  resources: Array<{ resourceType: string; unitPrice: number; unit: string }>
}

export interface UsageRecord {
  providerId: string
  resourceType: string
  quantity: number
  periodDays: number
}

export interface CostItem {
  providerId: string
  providerName: string
  resourceType: string
  quantity: number
  unitPrice: number
  totalCost: number
}

export interface OptimizationRecommendation {
  currentProviderId: string
  targetProviderId: string
  resourceType: string
  currentCost: number
  targetCost: number
  savingsAmount: number
  savingsPercent: number
}

export interface CostAnalysisReport {
  resourceType: string
  costs: CostItem[]
  cheapestProviderId: string
  totalCurrentCost: number
  recommendations: OptimizationRecommendation[]
  analysisAt: number
}

export interface CostAuditEntry {
  action: 'providerRegistered' | 'usageRecorded' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class MulticloudCostOptimizer {
  private readonly providers = new Map<string, CloudProvider>()
  private readonly usageRecords: UsageRecord[] = []
  private readonly auditLog: CostAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 멀티클라우드 비용 최적화 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R179.1 */
  registerProvider(provider: CloudProvider): void {
    if (!provider.id.trim()) throw new Error('provider id must not be empty')
    this.providers.set(provider.id, { ...provider, resources: [...provider.resources] })
    this.audit('providerRegistered', { id: provider.id, name: provider.name })
  }

  /** FR-R179.2 */
  recordUsage(record: UsageRecord): void {
    if (!this.providers.has(record.providerId)) {
      throw new Error(`unknown provider: ${record.providerId}`)
    }
    if (record.quantity < 0) throw new Error('quantity must be >= 0')
    this.usageRecords.push({ ...record })
    this.audit('usageRecorded', { providerId: record.providerId, resourceType: record.resourceType })
  }

  /** FR-R179.3 ~ FR-R179.4 */
  analyzeCost(resourceType: string): CostAnalysisReport {
    const relevantRecords = this.usageRecords.filter((r) => r.resourceType === resourceType)

    const costs: CostItem[] = []
    for (const record of relevantRecords) {
      const provider = this.providers.get(record.providerId)
      if (!provider) continue
      const resourceDef = provider.resources.find((r) => r.resourceType === resourceType)
      if (!resourceDef) continue
      const totalCost = record.quantity * resourceDef.unitPrice
      costs.push({
        providerId: record.providerId,
        providerName: provider.name,
        resourceType,
        quantity: record.quantity,
        unitPrice: resourceDef.unitPrice,
        totalCost,
      })
    }

    costs.sort((a, b) => a.totalCost - b.totalCost)
    const cheapest = costs[0]

    const recommendations: OptimizationRecommendation[] = []
    for (const cost of costs) {
      if (cheapest && cost.providerId !== cheapest.providerId && cheapest.totalCost < cost.totalCost) {
        const savingsAmount = cost.totalCost - cheapest.totalCost
        const savingsPercent = cost.totalCost > 0 ? (savingsAmount / cost.totalCost) * 100 : 0
        if (savingsPercent >= 20) {
          recommendations.push({
            currentProviderId: cost.providerId,
            targetProviderId: cheapest.providerId,
            resourceType,
            currentCost: cost.totalCost,
            targetCost: cheapest.totalCost,
            savingsAmount,
            savingsPercent,
          })
        }
      }
    }

    const totalCurrentCost = costs.reduce((sum, c) => sum + c.totalCost, 0)

    const report: CostAnalysisReport = {
      resourceType,
      costs,
      cheapestProviderId: cheapest?.providerId ?? '',
      totalCurrentCost,
      recommendations,
      analysisAt: Date.now(),
    }

    this.audit('analyzed', { resourceType, providers: costs.length, recommendations: recommendations.length })
    return report
  }

  /** FR-R179.5 */
  getAuditLog(): readonly CostAuditEntry[] {
    return [...this.auditLog]
  }

  private audit(action: CostAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
