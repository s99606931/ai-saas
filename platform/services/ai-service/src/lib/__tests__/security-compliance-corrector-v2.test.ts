import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityComplianceCorrectorV2 } from '../security-compliance-corrector-v2'

describe('SecurityComplianceCorrectorV2', () => {
  let corrector: SecurityComplianceCorrectorV2

  beforeEach(() => { corrector = new SecurityComplianceCorrectorV2() })

  it('should register a rule', () => {
    corrector.registerRule('r1', 'TLS Required', 'network', 'high')
    expect(corrector.getCorrectionRate()).toBe(100)
  })

  it('should record a violation', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    corrector.recordViolation('v1', 'r1', 'server-1')
    expect(corrector.getUncorrectedViolations()).toHaveLength(1)
  })

  it('should mark violation as corrected', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    corrector.recordViolation('v1', 'r1', 'server-1')
    corrector.markCorrected('v1')
    expect(corrector.getUncorrectedViolations()).toHaveLength(0)
  })

  it('should compute correction rate', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    corrector.recordViolation('v1', 'r1', 's1')
    corrector.recordViolation('v2', 'r1', 's2')
    corrector.markCorrected('v1')
    expect(corrector.getCorrectionRate()).toBe(50)
  })

  it('should block C grade data', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    expect(() => corrector.recordViolation('v1', 'r1', 's1', 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    expect(() => corrector.recordViolation('v1', 'r1', 's1', 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    corrector.registerRule('r1', 'TLS', 'network', 'high')
    corrector.recordViolation('v1', 'r1', 's1')
    expect(corrector.getAuditLog().length).toBeGreaterThan(0)
  })
})
