/**
 * Unit tests for Multicloud Strategy Advisor — SVC-AI-ADV-R129
 */
import { describe, it, expect } from 'vitest'
import { MulticloudStrategyAdvisor, DataGrade } from '../multicloud-strategy-advisor'

const makeProfile = (overrides = {}) => ({
  id: 'wl-001',
  name: '민원 처리 서비스',
  type: 'stateless' as const,
  grade: DataGrade.O,
  cpuCores: 4,
  memoryGiB: 8,
  storageGiB: 100,
  networkGbpsEgress: 1,
  availabilityRequirement: '99.9' as const,
  dataResidencyRequired: true,
  csapComplianceRequired: true,
  monthlyCostBudgetKrw: 5_000_000,
  ...overrides,
})

describe('SVC-AI-ADV-R129 MulticloudStrategyAdvisor', () => {
  it('[FR-R129.1] registers workload', () => {
    const advisor = new MulticloudStrategyAdvisor()
    advisor.registerWorkload(makeProfile())
    const report = advisor.generateStrategy()
    expect(report.workloadCount).toBe(1)
  })

  it('[FR-R129.1] blocks C/S grade workloads', () => {
    const advisor = new MulticloudStrategyAdvisor()
    expect(() => advisor.registerWorkload(makeProfile({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => advisor.registerWorkload(makeProfile({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R129.3] CSAP required → only CSAP-certified providers recommended', () => {
    const advisor = new MulticloudStrategyAdvisor()
    advisor.registerWorkload(makeProfile({ csapComplianceRequired: true, dataResidencyRequired: true }))
    const rec = advisor.recommend('wl-001')
    expect(['on-premise', 'ncp', 'ktncloud']).toContain(rec.recommendedProvider)
  })

  it('[FR-R129.4] recommend returns options array', () => {
    const advisor = new MulticloudStrategyAdvisor()
    advisor.registerWorkload(makeProfile())
    const rec = advisor.recommend('wl-001')
    expect(rec.options.length).toBeGreaterThan(0)
    expect(rec.options[0]!.estimatedMonthlyCostKrw).toBeGreaterThanOrEqual(0)
  })

  it('[FR-R129.5] generateStrategy totals cost across workloads', () => {
    const advisor = new MulticloudStrategyAdvisor()
    advisor.registerWorkload(makeProfile({ id: 'wl-001' }))
    advisor.registerWorkload(makeProfile({ id: 'wl-002', name: '행정 API' }))
    const report = advisor.generateStrategy()
    expect(report.recommendations).toHaveLength(2)
    expect(report.totalEstimatedMonthlyCostKrw).toBeGreaterThan(0)
  })

  it('[FR-R129.6] hybridRatio 0% when on-premise is cheapest', () => {
    const advisor = new MulticloudStrategyAdvisor()
    // Budget just enough for on-premise (base=0 + resources) but not cloud (base>=140_000)
    // on-premise: 0 + 4*20k + 8*8k + 100*200 + 1*50k = 0+80k+64k+20k+50k = 214k
    // ncp: 150k + 214k = 364k — over budget
    advisor.registerWorkload(makeProfile({ monthlyCostBudgetKrw: 250_000 }))
    const report = advisor.generateStrategy()
    expect(report.hybridRatio).toBe(0)
    expect(report.recommendations[0]!.recommendedProvider).toBe('on-premise')
  })

  it('throws when recommending unknown workload', () => {
    const advisor = new MulticloudStrategyAdvisor()
    expect(() => advisor.recommend('unknown')).toThrow('not found')
  })

  it('audit log records recommend and generateStrategy', () => {
    const advisor = new MulticloudStrategyAdvisor()
    advisor.registerWorkload(makeProfile())
    advisor.generateStrategy()
    const log = advisor.getAuditLog()
    expect(log.some(e => e.action === 'recommend')).toBe(true)
    expect(log.some(e => e.action === 'generateStrategy')).toBe(true)
  })
})
