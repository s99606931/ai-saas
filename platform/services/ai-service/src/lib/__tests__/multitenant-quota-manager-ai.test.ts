import { describe, it, expect, beforeEach } from 'vitest'
import { MultitenantQuotaManagerAi, type TenantQuota, type QuotaUsage } from '../multitenant-quota-manager-ai'

describe('MultitenantQuotaManagerAi', () => {
  let manager: MultitenantQuotaManagerAi

  const tenant: TenantQuota = {
    tenantId: 'TENANT001',
    orgName: '행정안전부',
    maxApiCallsPerHour: 1000,
    maxStorageGb: 100,
    maxConcurrentUsers: 50,
    tier: 'STANDARD',
  }

  beforeEach(() => {
    manager = new MultitenantQuotaManagerAi()
    manager.registerTenant(tenant)
  })

  it('테넌트 등록 감사 로그', () => {
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'tenant.register')).toBe(true)
  })

  it('정상 사용량 → overallStatus NORMAL', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 100, storageUsedGb: 10, concurrentUsers: 5 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    expect(report.overallStatus).toBe('NORMAL')
  })

  it('API 75% 초과 → apiCallStatus WARNING', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 800, storageUsedGb: 10, concurrentUsers: 5 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    expect(report.apiCallStatus).toBe('WARNING')
  })

  it('API 90% 초과 → apiCallStatus THROTTLED', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 950, storageUsedGb: 10, concurrentUsers: 5 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    expect(report.apiCallStatus).toBe('THROTTLED')
  })

  it('API 100% → EXCEEDED + 업그레이드 권고', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 1000, storageUsedGb: 10, concurrentUsers: 5 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    expect(report.apiCallStatus).toBe('EXCEEDED')
    expect(report.recommendations.some((r) => r.includes('쿼터'))).toBe(true)
  })

  it('EXCEEDED + STANDARD → PREMIUM 업그레이드 권고', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 1000, storageUsedGb: 100, concurrentUsers: 50 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    expect(report.recommendations.some((r) => r.includes('PREMIUM'))).toBe(true)
  })

  it('overallStatus = 3가지 중 최대 심각도', () => {
    const usage: QuotaUsage = { tenantId: 'TENANT001', timestamp: Date.now(), apiCallsThisHour: 100, storageUsedGb: 80, concurrentUsers: 5 }
    manager.recordUsage(usage)
    const report = manager.report('TENANT001')
    // storageUsedGb 80/100 = 80% → WARNING, API NORMAL → overall WARNING
    expect(report.overallStatus).toBe('WARNING')
  })

  it('미등록 테넌트 에러', () => {
    expect(() => manager.report('UNKNOWN')).toThrow()
  })

  it('리포트 후 감사 로그', () => {
    manager.report('TENANT001')
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'quota.report')).toBe(true)
  })
})
