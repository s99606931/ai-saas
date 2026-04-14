import { describe, it, expect, beforeEach } from 'vitest'
import { RiskManagementAutomatorV2 } from '../risk-management-automator-v2'

describe('RiskManagementAutomatorV2', () => {
  let automator: RiskManagementAutomatorV2

  beforeEach(() => {
    automator = new RiskManagementAutomatorV2()
  })

  it('should register a risk item', () => {
    automator.registerRisk('r1', 'Data Breach', 'security')
    expect(automator.getRiskScore('r1')).toBe(0)
  })

  it('should compute risk score as likelihood * impact', () => {
    automator.registerRisk('r1', 'Data Breach', 'security')
    automator.recordAssessment('r1', 3, 5)
    expect(automator.getRiskScore('r1')).toBe(15)
  })

  it('should identify high risks (score >= 15)', () => {
    automator.registerRisk('r1', 'High', 'security')
    automator.registerRisk('r2', 'Low', 'operational')
    automator.recordAssessment('r1', 3, 5) // 15
    automator.recordAssessment('r2', 2, 3) // 6
    const high = automator.getHighRisks()
    expect(high.map((r: { riskId: string }) => r.riskId)).toContain('r1')
    expect(high.map((r: { riskId: string }) => r.riskId)).not.toContain('r2')
  })

  it('should update assessment on re-record', () => {
    automator.registerRisk('r1', 'X', 'x')
    automator.recordAssessment('r1', 2, 2) // 4
    automator.recordAssessment('r1', 5, 5) // 25
    expect(automator.getRiskScore('r1')).toBe(25)
  })

  it('should block C grade data', () => {
    automator.registerRisk('r1', 'X', 'x')
    expect(() => automator.recordAssessment('r1', 2, 3, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    automator.registerRisk('r1', 'X', 'x')
    expect(() => automator.recordAssessment('r1', 2, 3, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    automator.registerRisk('r1', 'X', 'x')
    automator.recordAssessment('r1', 3, 4)
    expect(automator.getAuditLog().length).toBeGreaterThan(0)
  })
})
