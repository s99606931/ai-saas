// Design Ref: §R438 — AI기반 지능형 서비스 요금제 최적화
// Plan SC: SVC-AI-ADV-R438-SC01

export type PlanTier = 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE'
export type OptimizationType = 'DOWNGRADE' | 'UPGRADE' | 'SWITCH_PLAN' | 'KEEP' | 'CANCEL'

export interface ServicePlan {
  planId: string
  tier: PlanTier
  monthlyPriceKrw: number
  includedUnits: number    // 포함된 사용량 단위
  overageRateKrw: number   // 초과 단위당 요금
  features: string[]
}

export interface TenantUsage {
  tenantId: string
  planId: string
  periodStart: string
  periodEnd: string
  usedUnits: number
  avgMonthlyUnits: number
  peakUnits: number
  totalSpentKrw: number
}

export interface PricingOptimization {
  tenantId: string
  currentPlanId: string
  recommendedPlanId: string
  optimizationType: OptimizationType
  estimatedMonthlySavingKrw: number
  utilizationRate: number   // 0..1 (포함 단위 대비 사용량)
  rationale: string
}

interface AuditEntry {
  timestamp: string
  action: string
  tenantId: string
  detail: Record<string, unknown>
}

export class ServicePricingOptimizerAI {
  private plans = new Map<string, ServicePlan>()
  private usageHistory = new Map<string, TenantUsage[]>()
  private auditLog: AuditEntry[] = []

  registerPlan(plan: ServicePlan): void {
    this.plans.set(plan.planId, plan)
    this.appendAudit('plan.register', 'system', { planId: plan.planId, tier: plan.tier })
  }

  recordUsage(usage: TenantUsage): void {
    const list = this.usageHistory.get(usage.tenantId) ?? []
    list.push(usage)
    this.usageHistory.set(usage.tenantId, list)
  }

  optimize(tenantId: string): PricingOptimization {
    const history = this.usageHistory.get(tenantId) ?? []
    this.appendAudit('pricing.optimize', tenantId, { historyCount: history.length })

    if (history.length === 0) {
      return {
        tenantId, currentPlanId: 'UNKNOWN', recommendedPlanId: 'UNKNOWN',
        optimizationType: 'KEEP', estimatedMonthlySavingKrw: 0, utilizationRate: 0,
        rationale: '사용 이력 없음 — 최적화 불가',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const latest = history[history.length - 1]!
    // history.length > 0 guaranteed by the check above
    const currentPlan = this.plans.get(latest.planId)

    if (!currentPlan) {
      return {
        tenantId, currentPlanId: latest.planId, recommendedPlanId: latest.planId,
        optimizationType: 'KEEP', estimatedMonthlySavingKrw: 0,
        utilizationRate: 0, rationale: '현재 요금제 정보 없음',
      }
    }

    const utilizationRate = currentPlan.includedUnits > 0
      ? Math.min(2, latest.avgMonthlyUnits / currentPlan.includedUnits)
      : 0

    // 최적 요금제 탐색
    const allPlans = Array.from(this.plans.values()).sort((a, b) => a.monthlyPriceKrw - b.monthlyPriceKrw)

    // 평균 사용량 커버 가능한 가장 저렴한 요금제
    const suitablePlans = allPlans.filter((p) => p.includedUnits >= latest.avgMonthlyUnits)
    const cheapestSuitable = suitablePlans[0]

    if (!cheapestSuitable || cheapestSuitable.planId === currentPlan.planId) {
      return {
        tenantId, currentPlanId: currentPlan.planId, recommendedPlanId: currentPlan.planId,
        optimizationType: 'KEEP', estimatedMonthlySavingKrw: 0,
        utilizationRate, rationale: '현재 요금제가 최적',
      }
    }

    const saving = currentPlan.monthlyPriceKrw - cheapestSuitable.monthlyPriceKrw
    const optimizationType: OptimizationType =
      saving > 0 ? (cheapestSuitable.tier < currentPlan.tier ? 'DOWNGRADE' : 'SWITCH_PLAN')
        : 'UPGRADE'

    return {
      tenantId,
      currentPlanId: currentPlan.planId,
      recommendedPlanId: cheapestSuitable.planId,
      optimizationType,
      estimatedMonthlySavingKrw: Math.max(0, saving),
      utilizationRate,
      rationale: `평균 사용량 ${latest.avgMonthlyUnits}단위 → ${cheapestSuitable.tier} 요금제 최적 (월 ${Math.max(0, saving).toLocaleString()}원 절감)`,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, tenantId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, tenantId, detail })
  }
}
