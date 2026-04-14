import { describe, it, expect, beforeEach } from 'vitest'
import { InterServiceSecurityEnhancerV2 } from '../inter-service-security-enhancer-v2'

describe('InterServiceSecurityEnhancerV2', () => {
  let enhancer: InterServiceSecurityEnhancerV2

  beforeEach(() => {
    enhancer = new InterServiceSecurityEnhancerV2()
  })

  it('should register a channel', () => {
    enhancer.registerChannel('ch1', 'api-to-db', 'api-service', 'db-service')
    expect(enhancer.getSecurityScore('ch1')).toBe(100)
  })

  it('should record passing check', () => {
    enhancer.registerChannel('ch1', 'api-to-db', 'api', 'db')
    enhancer.recordCheck('ch1', 'tls', true)
    expect(enhancer.getSecurityScore('ch1')).toBe(100)
  })

  it('should calculate score as passedChecks/totalChecks*100', () => {
    enhancer.registerChannel('ch1', 'api-to-db', 'api', 'db')
    enhancer.recordCheck('ch1', 'tls', true)
    enhancer.recordCheck('ch1', 'auth', false)
    enhancer.recordCheck('ch1', 'rate-limit', true)
    enhancer.recordCheck('ch1', 'encrypt', false)
    expect(enhancer.getSecurityScore('ch1')).toBe(50)
  })

  it('should detect low security channels (score < 70)', () => {
    enhancer.registerChannel('ch1', 'weak-chan', 'svc-a', 'svc-b')
    enhancer.recordCheck('ch1', 'tls', true)
    enhancer.recordCheck('ch1', 'auth', false)
    enhancer.recordCheck('ch1', 'encrypt', false)
    const lowSec = enhancer.getLowSecurityChannels()
    expect(lowSec.map((c: { channelId: string }) => c.channelId)).toContain('ch1')
  })

  it('should not flag high security channel', () => {
    enhancer.registerChannel('ch1', 'secure', 'svc-a', 'svc-b')
    enhancer.recordCheck('ch1', 'tls', true)
    enhancer.recordCheck('ch1', 'auth', true)
    enhancer.recordCheck('ch1', 'encrypt', true)
    expect(enhancer.getLowSecurityChannels()).toHaveLength(0)
  })

  it('should block C grade data', () => {
    enhancer.registerChannel('ch1', 'test', 'a', 'b')
    expect(() => enhancer.recordCheck('ch1', 'tls', true, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    enhancer.registerChannel('ch1', 'test', 'a', 'b')
    expect(() => enhancer.recordCheck('ch1', 'auth', true, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    enhancer.registerChannel('ch1', 'chan', 'a', 'b')
    enhancer.recordCheck('ch1', 'tls', true)
    expect(enhancer.getAuditLog().length).toBeGreaterThan(0)
  })
})
