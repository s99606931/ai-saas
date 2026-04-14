import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceDependencyHealthV2 } from '../service-dependency-health-v2'

describe('ServiceDependencyHealthV2', () => {
  let healthChecker: ServiceDependencyHealthV2

  beforeEach(() => {
    healthChecker = new ServiceDependencyHealthV2()
  })

  it('서비스 등록 후 조회 가능', () => {
    const svc = healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    expect(svc.serviceId).toBe('svc-1')
    expect(svc.version).toBe('v1.0')
  })

  it('기록 없으면 건강 점수 100', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    expect(healthChecker.getHealthScore('svc-1', 'dep-1')).toBe(100)
  })

  it('건강 점수 공식 검증', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    healthChecker.recordDependencyHealth('svc-1', 'dep-1', 100, 5)
    // score = 100 - 100/10 - 5*2 = 100 - 10 - 10 = 80
    expect(healthChecker.getHealthScore('svc-1', 'dep-1')).toBe(80)
  })

  it('건강 점수 최소 0', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    healthChecker.recordDependencyHealth('svc-1', 'dep-1', 2000, 50)
    expect(healthChecker.getHealthScore('svc-1', 'dep-1')).toBe(0)
  })

  it('getUnhealthyDependencies: score < 60', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    healthChecker.recordDependencyHealth('svc-1', 'dep-1', 50, 2)
    healthChecker.recordDependencyHealth('svc-1', 'dep-2', 500, 20)
    const unhealthy = healthChecker.getUnhealthyDependencies('svc-1')
    expect(unhealthy.map((d) => d.dependencyId)).toContain('dep-2')
    expect(unhealthy.map((d) => d.dependencyId)).not.toContain('dep-1')
  })

  it('C등급 데이터 전송 차단', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    expect(() => healthChecker.recordDependencyHealth('svc-1', 'dep-1', 100, 5, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    expect(() => healthChecker.recordDependencyHealth('svc-1', 'dep-1', 100, 5, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    healthChecker.registerService('svc-1', '민원서비스', 'v1.0')
    healthChecker.recordDependencyHealth('svc-1', 'dep-1', 100, 5)
    const log = healthChecker.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
