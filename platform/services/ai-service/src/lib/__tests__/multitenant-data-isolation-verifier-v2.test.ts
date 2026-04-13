import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantDataIsolationVerifierV2 } from '../multitenant-data-isolation-verifier-v2'

describe('MultitenantDataIsolationVerifierV2', () => {
  let verifier: MultitenantDataIsolationVerifierV2

  beforeEach(() => {
    verifier = new MultitenantDataIsolationVerifierV2()
    verifier.registerTenant({ tenantId: 'T-1', name: 'A기관', isolationLevel: 'STRICT', allowedResources: ['SHARED-1'], dataClassification: 'CONFIDENTIAL' })
    verifier.registerTenant({ tenantId: 'T-2', name: 'B기관', isolationLevel: 'STANDARD', allowedResources: [], dataClassification: 'INTERNAL' })
  })

  it('알 수 없는 테넌트 오류', () => {
    expect(() => verifier.verify({ attemptId: 'A-1', tenantId: 'UNKNOWN', resourceId: 'R-1', resourceOwnerId: 'T-2', operation: 'READ', timestamp: Date.now() })).toThrow('Unknown tenant')
  })

  it('자신 소유 리소스 접근 허용', () => {
    const result = verifier.verify({ attemptId: 'A-2', tenantId: 'T-1', resourceId: 'R-OWN', resourceOwnerId: 'T-1', operation: 'READ', timestamp: Date.now() })
    expect(result.allowed).toBe(true)
    expect(result.violations.length).toBe(0)
  })

  it('허용된 공유 리소스 접근 허용', () => {
    const result = verifier.verify({ attemptId: 'A-3', tenantId: 'T-1', resourceId: 'SHARED-1', resourceOwnerId: 'T-2', operation: 'READ', timestamp: Date.now() })
    expect(result.allowed).toBe(true)
  })

  it('미허용 타 테넌트 리소스 READ — 격리 위반', () => {
    const result = verifier.verify({ attemptId: 'A-4', tenantId: 'T-1', resourceId: 'T2-SECRET', resourceOwnerId: 'T-2', operation: 'READ', timestamp: Date.now() })
    expect(result.violations.length).toBeGreaterThan(0)
  })

  it('타 테넌트 리소스 DELETE — CRITICAL 위반', () => {
    const result = verifier.verify({ attemptId: 'A-5', tenantId: 'T-2', resourceId: 'T1-DATA', resourceOwnerId: 'T-1', operation: 'DELETE', timestamp: Date.now() })
    expect(result.violations.some((v) => v.severity === 'CRITICAL')).toBe(true)
    expect(result.allowed).toBe(false)
  })

  it('위반 로그 복사본 반환', () => {
    verifier.verify({ attemptId: 'A-6', tenantId: 'T-2', resourceId: 'T1-DATA', resourceOwnerId: 'T-1', operation: 'DELETE', timestamp: Date.now() })
    const vlog = verifier.getViolationLog()
    expect(vlog.length).toBeGreaterThan(0)
  })

  it('감사 로그 복사본 반환', () => {
    verifier.verify({ attemptId: 'A-7', tenantId: 'T-1', resourceId: 'R-OWN', resourceOwnerId: 'T-1', operation: 'READ', timestamp: Date.now() })
    const log = verifier.getAuditLog()
    log.push({ timestamp: '', action: 'injected', tenantId: 'X', detail: {} })
    expect(verifier.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
