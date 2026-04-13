import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceDependencyAutoUpdater, type ServiceDependencies } from '../service-dependency-auto-updater'

describe('ServiceDependencyAutoUpdater', () => {
  let updater: ServiceDependencyAutoUpdater

  const service: ServiceDependencies = {
    serviceId: 'SVC001',
    serviceName: '민원 API',
    packages: [
      { packageId: 'PKG001', name: 'lodash', currentVersion: '4.17.20', latestVersion: '4.17.21', hasSecurityPatch: true, breakingChange: false, licenseCompatible: true },
      { packageId: 'PKG002', name: 'express', currentVersion: '4.18.0', latestVersion: '5.0.0', hasSecurityPatch: false, breakingChange: true, licenseCompatible: true },
      { packageId: 'PKG003', name: 'gpl-lib', currentVersion: '1.0.0', latestVersion: '1.1.0', hasSecurityPatch: false, breakingChange: false, licenseCompatible: false },
    ],
  }

  beforeEach(() => {
    updater = new ServiceDependencyAutoUpdater()
    updater.registerService(service)
  })

  it('서비스 등록 감사 로그', () => {
    const log = updater.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('보안 패치 → AUTO_UPDATE CRITICAL', () => {
    const plan = updater.plan('SVC001')
    const rec = plan.recommendations.find((r) => r.packageId === 'PKG001')!
    expect(rec.action).toBe('AUTO_UPDATE')
    expect(rec.priority).toBe('CRITICAL')
  })

  it('Breaking change → MANUAL_REVIEW', () => {
    const plan = updater.plan('SVC001')
    const rec = plan.recommendations.find((r) => r.packageId === 'PKG002')!
    expect(rec.action).toBe('MANUAL_REVIEW')
    expect(rec.priority).toBe('HIGH')
  })

  it('라이선스 비호환 → BLOCK CRITICAL', () => {
    const plan = updater.plan('SVC001')
    const rec = plan.recommendations.find((r) => r.packageId === 'PKG003')!
    expect(rec.action).toBe('BLOCK')
    expect(rec.priority).toBe('CRITICAL')
  })

  it('집계 카운트 정확', () => {
    const plan = updater.plan('SVC001')
    expect(plan.autoUpdateCount).toBe(1)
    expect(plan.manualReviewCount).toBe(1)
    expect(plan.blockedCount).toBe(1)
  })

  it('최신 버전이면 권고사항 없음', () => {
    updater.registerService({ ...service, serviceId: 'SVC002', packages: [{ ...service.packages[0]!, packageId: 'UP', currentVersion: '1.0.0', latestVersion: '1.0.0', hasSecurityPatch: false, breakingChange: false, licenseCompatible: true }] })
    const plan = updater.plan('SVC002')
    expect(plan.recommendations.length).toBe(0)
  })

  it('미등록 서비스 에러', () => {
    expect(() => updater.plan('UNKNOWN')).toThrow()
  })

  it('계획 후 감사 로그', () => {
    updater.plan('SVC001')
    const log = updater.getAuditLog()
    expect(log.some((e) => e.action === 'dependency.plan')).toBe(true)
  })
})
