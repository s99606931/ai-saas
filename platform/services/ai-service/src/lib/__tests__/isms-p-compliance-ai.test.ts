/**
 * Unit tests for ISMS-P Compliance AI — SVC-AI-ADV-R145
 */
import { describe, it, expect } from 'vitest'
import { IsmsPComplianceAi, DataGrade } from '../isms-p-compliance-ai'

const makeEvidence = (controlId: string, overrides = {}) => ({
  controlId,
  description: '정책 문서 v2.0',
  filePath: 'docs/policy.pdf',
  reviewedAt: '2026-04-12',
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R145 IsmsPComplianceAi', () => {
  it('[FR-R145.1] lists all ISMS-P controls', () => {
    const ai = new IsmsPComplianceAi()
    const controls = ai.listControls()
    expect(controls.length).toBeGreaterThanOrEqual(20)
    expect(controls.some(c => c.id === '1.1.1')).toBe(true)
  })

  it('[FR-R145.2] updates control status', () => {
    const ai = new IsmsPComplianceAi()
    ai.updateControlStatus('1.1.1', 'compliant')
    const summary = ai.generateSummary()
    expect(summary.compliant).toBeGreaterThanOrEqual(1)
  })

  it('[FR-R145.3] adds evidence for control', () => {
    const ai = new IsmsPComplianceAi()
    ai.addEvidence(makeEvidence('1.2.1'))
    expect(ai.getAuditLog().some(e => e.action === 'addEvidence')).toBe(true)
  })

  it('[FR-R145.3] blocks C/S grade evidence', () => {
    const ai = new IsmsPComplianceAi()
    expect(() => ai.addEvidence(makeEvidence('1.2.1', { grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => ai.addEvidence(makeEvidence('1.2.1', { grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R145.4] detects expiring evidence within 90 days', () => {
    const ai = new IsmsPComplianceAi()
    const expiringSoon = new Date('2026-04-12')
    expiringSoon.setDate(expiringSoon.getDate() + 30)  // expires in 30 days
    ai.addEvidence(makeEvidence('2.7.1', { expiresAt: expiringSoon.toISOString() }))
    const summary = ai.generateSummary(new Date('2026-04-12'))
    expect(summary.expiringSoon.length).toBeGreaterThan(0)
    expect(summary.expiringSoon[0]!.controlId).toBe('2.7.1')
  })

  it('[FR-R145.5] non-compliant required controls appear as criticalGaps', () => {
    const ai = new IsmsPComplianceAi()
    // All controls default to non-compliant
    const summary = ai.generateSummary()
    expect(summary.criticalGaps.length).toBeGreaterThan(0)
    expect(summary.criticalGaps).toContain('1.1.1')
  })

  it('[FR-R145.7] overallPercent improves as controls pass', () => {
    const ai = new IsmsPComplianceAi()
    const before = ai.generateSummary().overallPercent
    const controls = ai.listControls()
    for (const c of controls) {
      ai.updateControlStatus(c.id, 'compliant')
    }
    const after = ai.generateSummary().overallPercent
    expect(after).toBeGreaterThan(before)
    expect(after).toBe(100)
  })

  it('throws on unknown control id', () => {
    const ai = new IsmsPComplianceAi()
    expect(() => ai.updateControlStatus('99.99.99', 'compliant')).toThrow('unknown ISMS-P control')
  })

  it('audit log records updateControlStatus and generateSummary', () => {
    const ai = new IsmsPComplianceAi()
    ai.updateControlStatus('1.1.1', 'compliant')
    ai.generateSummary()
    const log = ai.getAuditLog()
    expect(log.some(e => e.action === 'updateControlStatus')).toBe(true)
    expect(log.some(e => e.action === 'generateSummary')).toBe(true)
  })
})
