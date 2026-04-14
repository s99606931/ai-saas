// Design Ref: §최적 가격 공식 — RealtimePricingOptimizerV2
// Plan SC: SVC-AI-ADV-R510

interface PricingPlan {
  planId: string
  name: string
  basePrice: number
  unit: string
}

interface AuditEntry {
  timestamp: string
  action: string
  planId: string
  details?: Record<string, unknown>
}

export class RealtimePricingOptimizerV2 {
  private plans = new Map<string, PricingPlan>()
  private demandLevels = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPlan(planId: string, name: string, basePrice: number, unit: string): PricingPlan {
    const plan: PricingPlan = { planId, name, basePrice, unit }
    this.plans.set(planId, plan)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_PLAN',
      planId,
      details: { name, basePrice, unit },
    })
    return plan
  }

  recordDemand(planId: string, demandLevel: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.plans.has(planId)) throw new Error(`요금제를 찾을 수 없습니다: ${planId}`)
    this.demandLevels.set(planId, demandLevel)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_DEMAND',
      planId,
      details: { demandLevel },
    })
  }

  getOptimalPrice(planId: string): number {
    const plan = this.plans.get(planId)
    if (!plan) throw new Error(`요금제를 찾을 수 없습니다: ${planId}`)
    const demand = this.demandLevels.get(planId)
    if (demand === undefined) return plan.basePrice
    return plan.basePrice * (1 + (demand / 100) * 0.5)
  }

  getHighDemandPlans(): PricingPlan[] {
    return Array.from(this.plans.values()).filter((plan) => {
      const demand = this.demandLevels.get(plan.planId) ?? 0
      return demand >= 70
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
