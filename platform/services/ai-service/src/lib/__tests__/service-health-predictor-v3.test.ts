// Plan SC: SVC-AI-ADV-R614
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceHealthPredictorV3 } from '../service-health-predictor-v3'

describe('ServiceHealthPredictorV3', () => {
  let p: ServiceHealthPredictorV3

  beforeEach(() => {
    p = new ServiceHealthPredictorV3()
  })

  it('register — 감사 로그', () => {
    p.register('s1', 'API')
    const log = p.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
  })

  it('predict — HEALTHY 판정', () => {
    p.register('s1', 'API')
    p.recordSample('s1', { cpu: 30, mem: 40, errorRate: 0.01 })
    const r = p.predict('s1')
    expect(r.status).toBe('HEALTHY')
  })

  it('predict — WARNING 판정 (cpu>70)', () => {
    p.register('s1', 'API')
    p.recordSample('s1', { cpu: 75, mem: 40, errorRate: 0.01 })
    expect(p.predict('s1').status).toBe('WARNING')
  })

  it('predict — CRITICAL 판정 (cpu>80 & mem>85)', () => {
    p.register('s1', 'API')
    p.recordSample('s1', { cpu: 90, mem: 90, errorRate: 0.01 })
    expect(p.predict('s1').status).toBe('CRITICAL')
  })

  it('recordSample — C/S 차단', () => {
    p.register('s1', 'API')
    expect(() =>
      p.recordSample('s1', { cpu: 10, mem: 10, errorRate: 0 }, 'C')
    ).toThrow(/BLOCKED/)
    expect(() =>
      p.recordSample('s1', { cpu: 10, mem: 10, errorRate: 0 }, 'S')
    ).toThrow(/BLOCKED/)
  })

  it('getCriticalServices — CRITICAL만 반환', () => {
    p.register('s1', 'API')
    p.register('s2', 'Worker')
    p.recordSample('s1', { cpu: 95, mem: 95, errorRate: 0 })
    p.recordSample('s2', { cpu: 30, mem: 30, errorRate: 0 })
    const critical = p.getCriticalServices()
    expect(critical).toHaveLength(1)
    expect(critical[0]!.serviceId).toBe('s1')
  })
})
