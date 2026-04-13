import { describe, it, expect, beforeEach } from 'vitest'
import { RolloutStrategyOptimizerAi, type RolloutContext } from '../rollout-strategy-optimizer-ai'

describe('RolloutStrategyOptimizerAi', () => {
  let optimizer: RolloutStrategyOptimizerAi

  const baseContext: RolloutContext = {
    serviceId: 'SVC001',
    serviceName: '민원 API',
    changeType: 'PATCH',
    hasDbMigration: false,
    estimatedImpactedUsers: 1000,
    currentErrorRate: 0.01,
    recentIncidentCount: 0,
  }

  beforeEach(() => {
    optimizer = new RolloutStrategyOptimizerAi()
  })

  it('HOTFIX → IMMEDIATE 전략, 100% 트래픽', () => {
    const plan = optimizer.optimize({ ...baseContext, changeType: 'HOTFIX' })
    expect(plan.recommendedStrategy).toBe('IMMEDIATE')
    expect(plan.initialTrafficPercent).toBe(100)
  })

  it('MAJOR 변경 (riskScore≥50) → BLUE_GREEN 전략', () => {
    const plan = optimizer.optimize({ ...baseContext, changeType: 'MAJOR', estimatedImpactedUsers: 20000 })
    expect(plan.recommendedStrategy).toBe('BLUE_GREEN')
    expect(plan.riskLevel).toBe('HIGH')
  })

  it('DB 마이그레이션 → BLUE_GREEN 전략', () => {
    const plan = optimizer.optimize({ ...baseContext, hasDbMigration: true })
    expect(plan.recommendedStrategy).toBe('BLUE_GREEN')
  })

  it('MINOR 변경 + 대규모 영향 (riskScore≥25) → CANARY 전략', () => {
    // MINOR(+15) + impactedUsers>10000(+20) = 35 → MEDIUM → CANARY
    const plan = optimizer.optimize({ ...baseContext, changeType: 'MINOR', estimatedImpactedUsers: 15000 })
    expect(plan.recommendedStrategy).toBe('CANARY')
    expect(plan.initialTrafficPercent).toBe(5)
    expect(plan.riskLevel).toBe('MEDIUM')
  })

  it('저위험 PATCH → ROLLING 전략', () => {
    const plan = optimizer.optimize(baseContext)
    expect(plan.recommendedStrategy).toBe('ROLLING')
    expect(plan.initialTrafficPercent).toBe(20)
    expect(plan.riskLevel).toBe('LOW')
  })

  it('롤아웃 단계 3단계 포함', () => {
    const plan = optimizer.optimize({ ...baseContext, changeType: 'MINOR' })
    expect(plan.rolloutSteps.length).toBe(3)
  })

  it('HIGH 위험 → 엄격한 롤백 트리거', () => {
    const plan = optimizer.optimize({ ...baseContext, changeType: 'MAJOR', estimatedImpactedUsers: 20000 })
    expect(plan.rollbackTrigger).toContain('0.1%')
  })

  it('최적화 후 감사 로그', () => {
    optimizer.optimize(baseContext)
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'rollout.optimize')).toBe(true)
  })
})
