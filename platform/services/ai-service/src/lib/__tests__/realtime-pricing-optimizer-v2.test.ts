import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimePricingOptimizerV2 } from '../realtime-pricing-optimizer-v2'

describe('RealtimePricingOptimizerV2', () => {
  let optimizer: RealtimePricingOptimizerV2

  beforeEach(() => {
    optimizer = new RealtimePricingOptimizerV2()
  })

  it('요금제 등록 후 조회 가능', () => {
    const plan = optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    expect(plan.planId).toBe('plan-1')
    expect(plan.basePrice).toBe(10000)
  })

  it('수요 없으면 basePrice 반환', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    expect(optimizer.getOptimalPrice('plan-1')).toBe(10000)
  })

  it('최적 가격 공식: basePrice * (1 + demand/100 * 0.5)', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    optimizer.recordDemand('plan-1', 100)
    // 10000 * (1 + 100/100 * 0.5) = 10000 * 1.5 = 15000
    expect(optimizer.getOptimalPrice('plan-1')).toBe(15000)
  })

  it('수요 50%: 가격 25% 증가', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    optimizer.recordDemand('plan-1', 50)
    expect(optimizer.getOptimalPrice('plan-1')).toBe(12500)
  })

  it('getHighDemandPlans: demandLevel >= 70', () => {
    optimizer.registerPlan('plan-1', '고수요', 10000, '월')
    optimizer.registerPlan('plan-2', '저수요', 5000, '월')
    optimizer.recordDemand('plan-1', 80)
    optimizer.recordDemand('plan-2', 30)
    const high = optimizer.getHighDemandPlans()
    expect(high.map((p) => p.planId)).toContain('plan-1')
    expect(high.map((p) => p.planId)).not.toContain('plan-2')
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    expect(() => optimizer.recordDemand('plan-1', 50, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    expect(() => optimizer.recordDemand('plan-1', 50, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerPlan('plan-1', '기본 요금제', 10000, '월')
    optimizer.recordDemand('plan-1', 50)
    const log = optimizer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
