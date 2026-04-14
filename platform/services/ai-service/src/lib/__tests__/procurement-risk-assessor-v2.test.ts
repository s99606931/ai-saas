import { describe, it, expect, beforeEach } from 'vitest'
import { ProcurementRiskAssessorV2 } from '../procurement-risk-assessor-v2'

describe('ProcurementRiskAssessorV2', () => {
  let assessor: ProcurementRiskAssessorV2

  beforeEach(() => { assessor = new ProcurementRiskAssessorV2() })

  it('should register a procurement with 0 initial risk', () => {
    assessor.registerProcurement('p1', 'Server Purchase', 'hardware', 10000000)
    expect(assessor.getOverallRisk('p1')).toBe(0)
  })

  it('should compute overall risk as average of 3 risk scores', () => {
    assessor.registerProcurement('p1', 'SW License', 'software', 5000000)
    assessor.recordAssessment('p1', 6, 8, 7) // avg = 7
    expect(assessor.getOverallRisk('p1')).toBeCloseTo(7, 1)
  })

  it('should identify high risk procurements (overall >= 7)', () => {
    assessor.registerProcurement('p1', 'Risky', 'hardware', 10000000)
    assessor.registerProcurement('p2', 'Safe', 'software', 1000000)
    assessor.recordAssessment('p1', 8, 9, 7)
    assessor.recordAssessment('p2', 3, 4, 2)
    const high = assessor.getHighRiskProcurements()
    expect(high.map((p: { procurementId: string }) => p.procurementId)).toContain('p1')
    expect(high.map((p: { procurementId: string }) => p.procurementId)).not.toContain('p2')
  })

  it('should update assessment on re-record', () => {
    assessor.registerProcurement('p1', 'X', 'x', 100)
    assessor.recordAssessment('p1', 2, 2, 2)
    assessor.recordAssessment('p1', 9, 9, 9)
    expect(assessor.getOverallRisk('p1')).toBe(9)
  })

  it('should block C grade data', () => {
    assessor.registerProcurement('p1', 'X', 'x', 100)
    expect(() => assessor.recordAssessment('p1', 5, 5, 5, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    assessor.registerProcurement('p1', 'X', 'x', 100)
    expect(() => assessor.recordAssessment('p1', 5, 5, 5, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    assessor.registerProcurement('p1', 'X', 'x', 100)
    assessor.recordAssessment('p1', 4, 5, 3)
    expect(assessor.getAuditLog().length).toBeGreaterThan(0)
  })
})
