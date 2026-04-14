import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceFaultIsolatorV3 } from '../service-fault-isolator-v3'

describe('ServiceFaultIsolatorV3', () => {
  let isolator: ServiceFaultIsolatorV3

  beforeEach(() => { isolator = new ServiceFaultIsolatorV3() })

  it('should register a service as not isolated', () => {
    isolator.registerService('svc1', 'API', 'tier1')
    expect(isolator.isIsolated('svc1')).toBe(false)
  })

  it('should isolate service when error rate > 50', () => {
    isolator.registerService('svc1', 'API', 'tier1')
    isolator.recordFault('f1', 'svc1', 55)
    expect(isolator.isIsolated('svc1')).toBe(true)
  })

  it('should not isolate service when error rate <= 50', () => {
    isolator.registerService('svc1', 'API', 'tier1')
    isolator.recordFault('f1', 'svc1', 40)
    expect(isolator.isIsolated('svc1')).toBe(false)
  })

  it('should return isolated services list', () => {
    isolator.registerService('svc1', 'Bad', 'tier1')
    isolator.registerService('svc2', 'Good', 'tier1')
    isolator.recordFault('f1', 'svc1', 80)
    const isolated = isolator.getIsolatedServices()
    expect(isolated.map((s: { serviceId: string }) => s.serviceId)).toContain('svc1')
    expect(isolated.map((s: { serviceId: string }) => s.serviceId)).not.toContain('svc2')
  })

  it('should block C grade data', () => {
    isolator.registerService('svc1', 'X', 'tier1')
    expect(() => isolator.recordFault('f1', 'svc1', 60, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    isolator.registerService('svc1', 'X', 'tier1')
    expect(() => isolator.recordFault('f1', 'svc1', 60, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    isolator.registerService('svc1', 'API', 'tier1')
    isolator.recordFault('f1', 'svc1', 30)
    expect(isolator.getAuditLog().length).toBeGreaterThan(0)
  })
})
