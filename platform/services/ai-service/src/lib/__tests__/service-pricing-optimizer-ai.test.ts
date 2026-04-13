// Plan SC: SVC-AI-ADV-R438-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServicePricingOptimizerAI, type ServicePlan } from '../service-pricing-optimizer-ai'

describe('ServicePricingOptimizerAI', () => {
  let optimizer: ServicePricingOptimizerAI

  const basicPlan: ServicePlan = {
    planId: 'PLAN-BASIC',
    tier: 'BASIC',
    monthlyPriceKrw: 50_000,
    includedUnits: 1000,
    overageRateKrw: 100,
    features: ['기본 기능'],
  }

  const premiumPlan: ServicePlan = {
    planId: 'PLAN-PREMIUM',
    tier: 'PREMIUM',
    monthlyPriceKrw: 200_000,
    includedUnits: 10000,
    overageRateKrw: 50,
    features: ['기본 기능', '고급 분석', '우선 지원'],
  }

  beforeEach(() => {
    optimizer = new ServicePricingOptimizerAI()
    optimizer.registerPlan(basicPlan)
    optimizer.registerPlan(premiumPlan)
  })

  it('사용 이력 없을 때 KEEP 반환', () => {
    const result = optimizer.optimize('TENANT-1')
    expect(result.optimizationType).toBe('KEEP')
    expect(result.estimatedMonthlySavingKrw).toBe(0)
  })

  it('현재 요금제가 최적 → KEEP', () => {
    optimizer.recordUsage({
      tenantId: 'T-KEEP',
      planId: 'PLAN-BASIC',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      usedUnits: 800,
      avgMonthlyUnits: 800,
      peakUnits: 950,
      totalSpentKrw: 50_000,
    })
    const result = optimizer.optimize('T-KEEP')
    expect(result.optimizationType).toBe('KEEP')
    expect(result.currentPlanId).toBe('PLAN-BASIC')
  })

  it('과다 요금제 사용 → DOWNGRADE 제안 + 절감액 계산', () => {
    optimizer.recordUsage({
      tenantId: 'T-DOWN',
      planId: 'PLAN-PREMIUM',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      usedUnits: 500,
      avgMonthlyUnits: 500,    // BASIC(1000단위) 으로 충분
      peakUnits: 600,
      totalSpentKrw: 200_000,
    })
    const result = optimizer.optimize('T-DOWN')
    expect(result.optimizationType).toBe('DOWNGRADE')
    expect(result.estimatedMonthlySavingKrw).toBeGreaterThan(0)
    expect(result.recommendedPlanId).toBe('PLAN-BASIC')
  })

  it('utilizationRate 정확히 계산', () => {
    optimizer.recordUsage({
      tenantId: 'T-UTIL',
      planId: 'PLAN-BASIC',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      usedUnits: 500,
      avgMonthlyUnits: 500,
      peakUnits: 600,
      totalSpentKrw: 50_000,
    })
    const result = optimizer.optimize('T-UTIL')
    expect(result.utilizationRate).toBeCloseTo(0.5, 1)  // 500/1000 = 0.5
  })

  it('rationale 문자열 반환', () => {
    optimizer.recordUsage({
      tenantId: 'T-RAT',
      planId: 'PLAN-PREMIUM',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      usedUnits: 200,
      avgMonthlyUnits: 200,
      peakUnits: 300,
      totalSpentKrw: 200_000,
    })
    const result = optimizer.optimize('T-RAT')
    expect(typeof result.rationale).toBe('string')
    expect(result.rationale.length).toBeGreaterThan(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.optimize('T-AUDIT')
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', tenantId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
