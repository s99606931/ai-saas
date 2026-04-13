// Design Ref: §R388 — AI기반 마이크로서비스 종속성 최적화 v2
import { describe, it, expect, beforeEach } from 'vitest'
import { MicroserviceDependencyOptimizerV2, type ServiceNode } from '../microservice-dependency-optimizer-v2'

describe('MicroserviceDependencyOptimizerV2', () => {
  let optimizer: MicroserviceDependencyOptimizerV2

  const makeService = (serviceId: string): ServiceNode => ({
    serviceId,
    serviceName: serviceId,
    tier: 'BACKEND',
    criticality: 'MEDIUM',
  })

  beforeEach(() => {
    optimizer = new MicroserviceDependencyOptimizerV2()
  })

  it('CIRCULAR: 순환 의존성 탐지 (A↔B)', () => {
    optimizer.registerService(makeService('svc-a'))
    optimizer.registerService(makeService('svc-b'))
    optimizer.addDependency({ fromServiceId: 'svc-a', toServiceId: 'svc-b', callFrequencyPerMin: 100, avgLatencyMs: 50, isSynchronous: true })
    optimizer.addDependency({ fromServiceId: 'svc-b', toServiceId: 'svc-a', callFrequencyPerMin: 100, avgLatencyMs: 50, isSynchronous: true })
    const report = optimizer.optimize()
    expect(report.issues.some((i) => i.issueType === 'CIRCULAR')).toBe(true)
  })

  it('HIGH_COUPLING: 5개 이상 서비스가 동일 서비스 의존', () => {
    optimizer.registerService(makeService('target'))
    for (let i = 0; i < 5; i++) {
      const svcId = `caller-${i}`
      optimizer.registerService(makeService(svcId))
      optimizer.addDependency({ fromServiceId: svcId, toServiceId: 'target', callFrequencyPerMin: 100, avgLatencyMs: 20, isSynchronous: false })
    }
    const report = optimizer.optimize()
    expect(report.issues.some((i) => i.issueType === 'HIGH_COUPLING' && i.affectedServices.includes('target'))).toBe(true)
  })

  it('SYNC_BOTTLENECK: 동기 고빈도 호출(>1000rpm) 탐지', () => {
    optimizer.registerService(makeService('svc-x'))
    optimizer.registerService(makeService('svc-y'))
    optimizer.addDependency({ fromServiceId: 'svc-x', toServiceId: 'svc-y', callFrequencyPerMin: 1500, avgLatencyMs: 30, isSynchronous: true })
    const report = optimizer.optimize()
    expect(report.issues.some((i) => i.issueType === 'SYNC_BOTTLENECK')).toBe(true)
  })

  it('이슈 없음: couplingScore 100', () => {
    optimizer.registerService(makeService('alone'))
    const report = optimizer.optimize()
    expect(report.issues).toHaveLength(0)
    expect(report.couplingScore).toBe(100)
  })

  it('이슈별 couplingScore 감점 (이슈 1개 → 85점)', () => {
    optimizer.registerService(makeService('svc-p'))
    optimizer.registerService(makeService('svc-q'))
    optimizer.addDependency({ fromServiceId: 'svc-p', toServiceId: 'svc-q', callFrequencyPerMin: 2000, avgLatencyMs: 10, isSynchronous: true })
    const report = optimizer.optimize()
    expect(report.couplingScore).toBe(85)
  })

  it('감사 로그에 optimize 기록', () => {
    optimizer.registerService(makeService('svc-z'))
    optimizer.optimize()
    const logs = optimizer.getAuditLog()
    expect(logs.some((l) => l.action === 'dependency.optimize')).toBe(true)
  })
})
