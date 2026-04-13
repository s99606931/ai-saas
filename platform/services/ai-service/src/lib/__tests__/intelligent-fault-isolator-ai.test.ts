import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentFaultIsolatorAi, type ServiceHealth, type FaultEvent } from '../intelligent-fault-isolator-ai'

describe('IntelligentFaultIsolatorAi', () => {
  let isolator: IntelligentFaultIsolatorAi

  const service: ServiceHealth = { serviceId: 'SVC001', name: '민원 서비스', replicaCount: 3, maxReplicas: 10 }

  const makeFault = (type: FaultEvent['faultType'], severity: FaultEvent['severity'], errorRate = 0.1, cpu = 50, mem = 50): FaultEvent => ({
    serviceId: 'SVC001',
    faultId: `F_${Date.now()}`,
    faultType: type,
    severity,
    errorRate,
    cpuPercent: cpu,
    memoryPercent: mem,
    timestamp: Date.now(),
  })

  beforeEach(() => {
    isolator = new IntelligentFaultIsolatorAi()
    isolator.registerService(service)
  })

  it('서비스 등록 감사 로그', () => {
    const log = isolator.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('CRITICAL 장애 → ISOLATE 자동 실행', () => {
    const decision = isolator.reportFault(makeFault('ERROR_SPIKE', 'CRITICAL', 0.9))
    expect(decision.action).toBe('ISOLATE')
    expect(decision.autoExecuted).toBe(true)
  })

  it('메모리 누수 90% 초과 → RESTART', () => {
    const decision = isolator.reportFault(makeFault('MEMORY_LEAK', 'HIGH', 0.05, 50, 95))
    expect(decision.action).toBe('RESTART')
  })

  it('CPU 급증 85% 초과 → SCALE_OUT', () => {
    const decision = isolator.reportFault(makeFault('CPU_SPIKE', 'HIGH', 0.05, 90, 50))
    expect(decision.action).toBe('SCALE_OUT')
  })

  it('에러율 50% 초과 → ISOLATE', () => {
    const decision = isolator.reportFault(makeFault('TIMEOUT', 'HIGH', 0.6))
    expect(decision.action).toBe('ISOLATE')
  })

  it('에러율 20~50% → THROTTLE', () => {
    const decision = isolator.reportFault(makeFault('TIMEOUT', 'MEDIUM', 0.3))
    expect(decision.action).toBe('THROTTLE')
  })

  it('미등록 서비스 에러', () => {
    expect(() => isolator.reportFault({ ...makeFault('TIMEOUT', 'LOW'), serviceId: 'UNKNOWN' })).toThrow()
  })

  it('장애 이력 조회', () => {
    isolator.reportFault(makeFault('TIMEOUT', 'MEDIUM', 0.05))
    const history = isolator.getFaultHistory('SVC001')
    expect(history.length).toBe(1)
  })

  it('격리 결정 후 감사 로그', () => {
    isolator.reportFault(makeFault('ERROR_SPIKE', 'HIGH', 0.6))
    const log = isolator.getAuditLog()
    expect(log.some((e) => e.action === 'fault.isolate')).toBe(true)
  })
})
