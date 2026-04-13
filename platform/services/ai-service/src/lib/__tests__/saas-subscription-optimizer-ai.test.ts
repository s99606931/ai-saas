import { describe, it, expect, beforeEach } from 'vitest'
import { SaasSubscriptionOptimizerAi, type SaasSubscription, type SubscriptionUsage } from '../saas-subscription-optimizer-ai'

describe('SaasSubscriptionOptimizerAi', () => {
  let optimizer: SaasSubscriptionOptimizerAi

  const subscription: SaasSubscription = {
    subscriptionId: 'SUB001',
    orgId: 'ORG001',
    serviceName: '공공 협업 플랫폼',
    tier: 'STANDARD',
    monthlyFee: 1000000,
    contractedUsers: 100,
    features: ['collaboration', 'storage', 'api'],
  }

  beforeEach(() => {
    optimizer = new SaasSubscriptionOptimizerAi()
    optimizer.registerSubscription(subscription)
  })

  it('구독 등록 감사 로그', () => {
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'subscription.register')).toBe(true)
  })

  it('사용률 50% 미만 → DOWNGRADE 권고', () => {
    const usage: SubscriptionUsage = { subscriptionId: 'SUB001', month: '2026-04', activeUsers: 30, featuresUsed: [], storageUsedGb: 10, apiCallCount: 100 }
    optimizer.recordUsage(usage)
    const report = optimizer.optimize('SUB001')
    expect(report.recommendedAction).toBe('DOWNGRADE')
    expect(report.estimatedMonthlySaving).toBeGreaterThan(0)
  })

  it('사용률 90% 이상 → UPGRADE 권고', () => {
    const usage: SubscriptionUsage = { subscriptionId: 'SUB001', month: '2026-04', activeUsers: 95, featuresUsed: [], storageUsedGb: 50, apiCallCount: 500 }
    optimizer.recordUsage(usage)
    const report = optimizer.optimize('SUB001')
    expect(report.recommendedAction).toBe('UPGRADE')
  })

  it('적정 사용률 → MAINTAIN', () => {
    const usage: SubscriptionUsage = { subscriptionId: 'SUB001', month: '2026-04', activeUsers: 70, featuresUsed: [], storageUsedGb: 30, apiCallCount: 300 }
    optimizer.recordUsage(usage)
    const report = optimizer.optimize('SUB001')
    expect(report.recommendedAction).toBe('MAINTAIN')
  })

  it('utilizationRate 계산 정확성', () => {
    const usage: SubscriptionUsage = { subscriptionId: 'SUB001', month: '2026-04', activeUsers: 50, featuresUsed: [], storageUsedGb: 20, apiCallCount: 200 }
    optimizer.recordUsage(usage)
    const report = optimizer.optimize('SUB001')
    expect(report.utilizationRate).toBe(0.5)
  })

  it('미등록 구독 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.optimize('SUB001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'subscription.optimize')).toBe(true)
  })
})
