// Design Ref: §R428 — Citizen Engagement Analyzer
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceSloAutoCalibratorV2 } from '../service-slo-auto-calibrator-v2'

describe('ServiceSloAutoCalibratorV2 (Engagement Analyzer)', () => {
  let analyzer: ServiceSloAutoCalibratorV2

  beforeEach(() => {
    analyzer = new ServiceSloAutoCalibratorV2()
  })

  it('grade HIGH: engagementIndex ≥ 70', () => {
    // rate=0.8 → responseScore=80, satisfaction=80, index=80 → HIGH
    const result = analyzer.analyze({ policyId: 'POL-001', participants: 800, targetPopulation: 1000, satisfaction: 80 })
    expect(result.grade).toBe('HIGH')
    expect(result.engagementIndex).toBeGreaterThanOrEqual(70)
  })

  it('grade MID: 40 ≤ engagementIndex < 70', () => {
    // rate=0.5 → responseScore=50, satisfaction=50, index=50 → MID
    const result = analyzer.analyze({ policyId: 'POL-002', participants: 500, targetPopulation: 1000, satisfaction: 50 })
    expect(result.grade).toBe('MID')
  })

  it('grade LOW: engagementIndex < 40', () => {
    // rate=0.1 → responseScore=10, satisfaction=20, index=15 → LOW
    const result = analyzer.analyze({ policyId: 'POL-003', participants: 100, targetPopulation: 1000, satisfaction: 20 })
    expect(result.grade).toBe('LOW')
  })

  it('participationRate: participants/targetPopulation', () => {
    const result = analyzer.analyze({ policyId: 'POL-004', participants: 300, targetPopulation: 1000, satisfaction: 60 })
    expect(result.participationRate).toBe(0.3)
  })

  it('responseScore clip: 최대 100', () => {
    const result = analyzer.analyze({ policyId: 'POL-005', participants: 2000, targetPopulation: 1000, satisfaction: 80 })
    expect(result.responseScore).toBe(100)
  })

  it('targetPopulation=0: participationRate=0', () => {
    const result = analyzer.analyze({ policyId: 'POL-006', participants: 100, targetPopulation: 0, satisfaction: 50 })
    expect(result.participationRate).toBe(0)
  })

  it('감사 로그에 engagement.analyze 기록', () => {
    analyzer.analyze({ policyId: 'POL-007', participants: 500, targetPopulation: 1000, satisfaction: 60 })
    const logs = analyzer.getAuditLog()
    expect(logs.some((l) => l.action === 'engagement.analyze')).toBe(true)
  })
})
