import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityPostureAssessorV2 } from '../security-posture-assessor-v2'

describe('SecurityPostureAssessorV2', () => {
  let assessor: SecurityPostureAssessorV2

  beforeEach(() => {
    assessor = new SecurityPostureAssessorV2()
  })

  it('should register a service and return 100 score initially', () => {
    assessor.registerService('svc1', 'Portal', 'tier1')
    expect(assessor.getSecurityScore('svc1')).toBe(100)
  })

  it('should compute score as passedChecks/totalChecks*100', () => {
    assessor.registerService('svc1', 'Portal', 'tier1')
    assessor.recordCheck('svc1', 'c1', 'auth', true)
    assessor.recordCheck('svc1', 'c2', 'tls', false)
    assessor.recordCheck('svc1', 'c3', 'rbac', true)
    assessor.recordCheck('svc1', 'c4', 'audit', false)
    expect(assessor.getSecurityScore('svc1')).toBe(50)
  })

  it('should identify vulnerable services (score < 70)', () => {
    assessor.registerService('svc1', 'Weak', 'tier2')
    assessor.registerService('svc2', 'Strong', 'tier1')
    assessor.recordCheck('svc1', 'c1', 'auth', true)
    assessor.recordCheck('svc1', 'c2', 'tls', false)
    assessor.recordCheck('svc1', 'c3', 'rbac', false)
    assessor.recordCheck('svc2', 'c1', 'auth', true)
    assessor.recordCheck('svc2', 'c2', 'tls', true)
    const vuln = assessor.getVulnerableServices()
    expect(vuln.map((s: { serviceId: string }) => s.serviceId)).toContain('svc1')
    expect(vuln.map((s: { serviceId: string }) => s.serviceId)).not.toContain('svc2')
  })

  it('should block C grade data', () => {
    assessor.registerService('svc1', 'X', 'tier1')
    expect(() => assessor.recordCheck('svc1', 'c1', 'auth', true, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    assessor.registerService('svc1', 'X', 'tier1')
    expect(() => assessor.recordCheck('svc1', 'c1', 'tls', true, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    assessor.registerService('svc1', 'Portal', 'tier1')
    assessor.recordCheck('svc1', 'c1', 'auth', true)
    expect(assessor.getAuditLog().length).toBeGreaterThan(0)
  })
})
