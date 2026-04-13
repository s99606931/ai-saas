// Design Ref: §R429 — AI Policy Impact Simulator v3
// Plan SC: SC-R429

export interface PolicyScenario {
  readonly scenarioId: string
  readonly baseRevenue: number
  readonly baseBeneficiaries: number
  readonly deltaTax: number
  readonly deltaBenefit: number
  readonly elasticityTax: number
  readonly elasticityBenefit: number
}

export type SimRec = 'PROCEED' | 'REVIEW' | 'REJECT'

export interface SimResult {
  readonly scenarioId: string
  readonly projectedRevenue: number
  readonly projectedBeneficiaries: number
  readonly sideEffectScore: number
  readonly recommendation: SimRec
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class ProcessMiningAi {
  private auditLog: AuditEntry[] = []

  simulate(scenario: PolicyScenario): SimResult {
    const projectedRevenue = Math.round(scenario.baseRevenue * (1 + scenario.elasticityTax * scenario.deltaTax))
    const projectedBeneficiaries = Math.round(scenario.baseBeneficiaries * (1 + scenario.elasticityBenefit * scenario.deltaBenefit))
    const sideEffectScore = Math.round(
      Math.max(0, Math.min(100, Math.abs(scenario.deltaTax) * 50 + Math.abs(scenario.deltaBenefit) * 30))
    )

    const recommendation: SimRec = sideEffectScore >= 70 ? 'REJECT' : sideEffectScore >= 40 ? 'REVIEW' : 'PROCEED'

    this.auditLog.push({ action: 'policy.simulate', timestamp: new Date().toISOString(), detail: `${scenario.scenarioId}:${recommendation}` })
    return { scenarioId: scenario.scenarioId, projectedRevenue, projectedBeneficiaries, sideEffectScore, recommendation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
