import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimePricingOptimizerAi, type ServicePricingConfig, type DemandMetric } from '../realtime-pricing-optimizer-ai'

describe('RealtimePricingOptimizerAi', () => {
  let ai: RealtimePricingOptimizerAi
  const now = Date.now()

  const config: ServicePricingConfig = {
    serviceId: 'SVC001',
    name: '공공 API',
    basePricePerUnit: 100,
    minPrice: 50,
    maxPrice: 200,
    dataGrade: 'O',
  }

  const normalMetric: DemandMetric = {
    serviceId: 'SVC001',
    timestamp: now,
    currentLoad: 50,
    maxCapacity: 100,
    queueDepth: 0,
  }

  beforeEach(() => {
    ai = new RealtimePricingOptimizerAi()
    ai.registerService(config)
  })

  it('C/S등급 서비스 등록 차단', () => {
    expect(() => ai.registerService({ ...config, serviceId: 'SVC_C', dataGrade: 'C' })).toThrow('BLOCKED')
    expect(() => ai.registerService({ ...config, serviceId: 'SVC_S', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('정상 부하 → STABLE', () => {
    const decision = ai.optimize(normalMetric)
    expect(decision.strategy).toBe('STABLE')
  })

  it('부하율 90% 이상 → SURGE 가격 인상', () => {
    const decision = ai.optimize({ ...normalMetric, currentLoad: 95, maxCapacity: 100 })
    expect(decision.strategy).toBe('SURGE')
    expect(decision.recommendedPrice).toBeGreaterThan(decision.currentPrice)
  })

  it('부하율 30% 미만 + queue 0 → DISCOUNT', () => {
    const decision = ai.optimize({ ...normalMetric, currentLoad: 20, maxCapacity: 100 })
    expect(decision.strategy).toBe('DISCOUNT')
    expect(decision.recommendedPrice).toBeLessThan(decision.currentPrice)
  })

  it('경쟁사 가격 10% 이상 저렴 → DISCOUNT', () => {
    const decision = ai.optimize({ ...normalMetric, competitorPrice: 80 })
    expect(decision.strategy).toBe('DISCOUNT')
  })

  it('추천 가격은 minPrice~maxPrice 범위 내', () => {
    const surge = ai.optimize({ ...normalMetric, currentLoad: 99, maxCapacity: 100 })
    expect(surge.recommendedPrice).toBeLessThanOrEqual(config.maxPrice)
    expect(surge.recommendedPrice).toBeGreaterThanOrEqual(config.minPrice)
  })

  it('미등록 서비스 에러', () => {
    expect(() => ai.optimize({ ...normalMetric, serviceId: 'UNKNOWN' })).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    ai.optimize(normalMetric)
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'pricing.optimize')).toBe(true)
  })
})
