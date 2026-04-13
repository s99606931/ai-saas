// Design Ref: §R429 — AI Policy Impact Simulator v3
import { describe, it, expect, beforeEach } from 'vitest'
import { ProcessMiningAi } from '../process-mining-ai'

describe('ProcessMiningAi (Policy Impact Simulator)', () => {
  let simulator: ProcessMiningAi

  beforeEach(() => {
    simulator = new ProcessMiningAi()
  })

  it('PROCEED: sideEffectScore < 40', () => {
    // |0.1|*50 + |0.1|*30 = 5+3 = 8 → PROCEED
    const result = simulator.simulate({ scenarioId: 'SC-001', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 0.1, deltaBenefit: 0.1, elasticityTax: -0.5, elasticityBenefit: 0.8 })
    expect(result.recommendation).toBe('PROCEED')
    expect(result.sideEffectScore).toBeLessThan(40)
  })

  it('REVIEW: 40 ≤ sideEffectScore < 70', () => {
    // |0.6|*50 + |0.2|*30 = 30+6 = 36... 다른 값 사용
    // |0.8|*50 + |0.2|*30 = 40+6 = 46 → REVIEW
    const result = simulator.simulate({ scenarioId: 'SC-002', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 0.8, deltaBenefit: 0.2, elasticityTax: -0.5, elasticityBenefit: 0.8 })
    expect(result.recommendation).toBe('REVIEW')
  })

  it('REJECT: sideEffectScore ≥ 70', () => {
    // |1.0|*50 + |0.8|*30 = 50+24 = 74 → REJECT
    const result = simulator.simulate({ scenarioId: 'SC-003', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 1.0, deltaBenefit: 0.8, elasticityTax: -0.5, elasticityBenefit: 0.8 })
    expect(result.recommendation).toBe('REJECT')
    expect(result.sideEffectScore).toBeGreaterThanOrEqual(70)
  })

  it('projectedRevenue: base*(1 + elasticity*delta)', () => {
    const result = simulator.simulate({ scenarioId: 'SC-004', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 0.1, deltaBenefit: 0.0, elasticityTax: -1.0, elasticityBenefit: 0 })
    // 1000000*(1 + -1.0*0.1) = 1000000*0.9 = 900000
    expect(result.projectedRevenue).toBe(900000)
  })

  it('projectedBeneficiaries: base*(1 + elasticity*delta)', () => {
    const result = simulator.simulate({ scenarioId: 'SC-005', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 0.0, deltaBenefit: 0.2, elasticityTax: 0, elasticityBenefit: 1.5 })
    // 10000*(1 + 1.5*0.2) = 10000*1.3 = 13000
    expect(result.projectedBeneficiaries).toBe(13000)
  })

  it('sideEffectScore clip: 최대 100', () => {
    const result = simulator.simulate({ scenarioId: 'SC-006', baseRevenue: 1000000, baseBeneficiaries: 10000, deltaTax: 5.0, deltaBenefit: 5.0, elasticityTax: -1, elasticityBenefit: 1 })
    expect(result.sideEffectScore).toBe(100)
  })

  it('감사 로그에 policy.simulate 기록', () => {
    simulator.simulate({ scenarioId: 'SC-007', baseRevenue: 500000, baseBeneficiaries: 5000, deltaTax: 0.05, deltaBenefit: 0.05, elasticityTax: -0.5, elasticityBenefit: 0.5 })
    const logs = simulator.getAuditLog()
    expect(logs.some((l) => l.action === 'policy.simulate')).toBe(true)
  })
})
