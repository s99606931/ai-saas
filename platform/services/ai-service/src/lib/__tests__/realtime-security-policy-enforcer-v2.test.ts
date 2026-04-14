import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeSecurityPolicyEnforcerV2 } from '../realtime-security-policy-enforcer-v2'

describe('RealtimeSecurityPolicyEnforcerV2', () => {
  let enforcer: RealtimeSecurityPolicyEnforcerV2

  beforeEach(() => { enforcer = new RealtimeSecurityPolicyEnforcerV2() })

  it('should register a policy', () => {
    enforcer.registerPolicy('pol1', 'Rate Limit', 'ratelimit', 100)
    expect(enforcer.getBlockRate()).toBe(0)
  })

  it('should block event when value exceeds threshold', () => {
    enforcer.registerPolicy('pol1', 'Rate Limit', 'ratelimit', 100)
    const blocked = enforcer.enforcePolicy('evt1', 'pol1', 150)
    expect(blocked).toBe(true)
  })

  it('should allow event when value is below threshold', () => {
    enforcer.registerPolicy('pol1', 'Rate Limit', 'ratelimit', 100)
    const blocked = enforcer.enforcePolicy('evt1', 'pol1', 80)
    expect(blocked).toBe(false)
  })

  it('should return blocked events list', () => {
    enforcer.registerPolicy('pol1', 'Rate Limit', 'ratelimit', 100)
    enforcer.enforcePolicy('evt1', 'pol1', 200)
    enforcer.enforcePolicy('evt2', 'pol1', 50)
    const blocked = enforcer.getBlockedEvents()
    expect(blocked.map((e: { eventId: string }) => e.eventId)).toContain('evt1')
    expect(blocked.map((e: { eventId: string }) => e.eventId)).not.toContain('evt2')
  })

  it('should compute block rate', () => {
    enforcer.registerPolicy('pol1', 'RL', 'ratelimit', 100)
    enforcer.enforcePolicy('e1', 'pol1', 200) // blocked
    enforcer.enforcePolicy('e2', 'pol1', 50)  // allowed
    expect(enforcer.getBlockRate()).toBe(50)
  })

  it('should block C grade data', () => {
    enforcer.registerPolicy('pol1', 'RL', 'ratelimit', 100)
    expect(() => enforcer.enforcePolicy('evt1', 'pol1', 50, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    enforcer.registerPolicy('pol1', 'RL', 'ratelimit', 100)
    expect(() => enforcer.enforcePolicy('evt1', 'pol1', 50, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    enforcer.registerPolicy('pol1', 'RL', 'ratelimit', 100)
    enforcer.enforcePolicy('evt1', 'pol1', 80)
    expect(enforcer.getAuditLog().length).toBeGreaterThan(0)
  })
})
