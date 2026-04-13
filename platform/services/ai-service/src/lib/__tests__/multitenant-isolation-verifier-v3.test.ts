// Plan SC: SVC-AI-ADV-R464-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantIsolationVerifierV3 } from '../multitenant-isolation-verifier-v3'

describe('MultitenantIsolationVerifierV3', () => {
  let verifier: MultitenantIsolationVerifierV3

  beforeEach(() => {
    verifier = new MultitenantIsolationVerifierV3()
  })

  it('리소스 없는 테넌트 → COMPLIANT, complianceScore=100', () => {
    const result = verifier.verify('TENANT-A')
    expect(result.status).toBe('COMPLIANT')
    expect(result.complianceScore).toBe(100)
    expect(result.violations).toHaveLength(0)
  })

  it('전용 리소스만 → COMPLIANT', () => {
    verifier.registerResource({ resourceId: 'R1', tenantId: 'TENANT-A', resourceType: 'DATA', isShared: false, allowedTenants: [] })
    const result = verifier.verify('TENANT-A')
    expect(result.status).toBe('COMPLIANT')
  })

  it('DATA 리소스 무허가 공유 → RESOURCE_SHARING CRITICAL, VIOLATED', () => {
    verifier.registerResource({ resourceId: 'R-DATA', tenantId: 'TENANT-A', resourceType: 'DATA', isShared: true, allowedTenants: [] })
    const result = verifier.verify('TENANT-A')
    const v = result.violations.find((v) => v.type === 'RESOURCE_SHARING')
    expect(v).toBeDefined()
    expect(v!.severity).toBe('CRITICAL')
    expect(result.status).toBe('VIOLATED')
  })

  it('COMPUTE 리소스 무허가 공유 → RESOURCE_SHARING HIGH', () => {
    verifier.registerResource({ resourceId: 'R-CPU', tenantId: 'TENANT-B', resourceType: 'COMPUTE', isShared: true, allowedTenants: [] })
    const result = verifier.verify('TENANT-B')
    const v = result.violations.find((v) => v.type === 'RESOURCE_SHARING')
    expect(v!.severity).toBe('HIGH')
  })

  it('타 테넌트 무허가 공유 DATA → DATA_LEAK 탐지', () => {
    verifier.registerResource({ resourceId: 'R-SHARED', tenantId: 'TENANT-C', resourceType: 'DATA', isShared: true, allowedTenants: [] })
    const result = verifier.verify('TENANT-D')
    const leak = result.violations.find((v) => v.type === 'DATA_LEAK')
    expect(leak).toBeDefined()
    expect(leak!.sourceTenantId).toBe('TENANT-C')
    expect(leak!.targetTenantId).toBe('TENANT-D')
  })

  it('getViolationLog: 복사본 반환 (불변성 보장)', () => {
    verifier.registerResource({ resourceId: 'R1', tenantId: 'T1', resourceType: 'DATA', isShared: true, allowedTenants: [] })
    verifier.verify('T1')
    const log1 = verifier.getViolationLog()
    const origLen = log1.length
    log1.push({ violationId: 'X', type: 'DATA_LEAK', severity: 'LOW', sourceTenantId: 'A', targetTenantId: 'B', resourceId: 'R', detail: 'tamper' })
    const log2 = verifier.getViolationLog()
    expect(log2.length).toBe(origLen)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    verifier.registerResource({ resourceId: 'R1', tenantId: 'T1', resourceType: 'COMPUTE', isShared: false, allowedTenants: [] })
    verifier.verify('T1')
    const log1 = verifier.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', tenantId: 'X', detail: {} })
    const log2 = verifier.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
