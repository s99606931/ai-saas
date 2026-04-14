import { describe, it, expect, beforeEach } from 'vitest'
import { PublicProcurementAutomationV3 } from '../public-procurement-automation-v3'

describe('PublicProcurementAutomationV3', () => {
  let automation: PublicProcurementAutomationV3

  beforeEach(() => { automation = new PublicProcurementAutomationV3() })

  it('should auto-approve request <= 5,000,000', () => {
    automation.registerRequest('r1', 'Laptop', 2, 4000000)
    expect(automation.getStatus('r1')).toBe('approved')
  })

  it('should set pending for request > 5,000,000', () => {
    automation.registerRequest('r1', 'Server', 1, 10000000)
    expect(automation.getStatus('r1')).toBe('pending')
  })

  it('should manually approve pending request', () => {
    automation.registerRequest('r1', 'Server', 1, 10000000)
    automation.approveRequest('r1')
    expect(automation.getStatus('r1')).toBe('approved')
  })

  it('should return pending requests', () => {
    automation.registerRequest('r1', 'Server', 1, 10000000)
    automation.registerRequest('r2', 'USB', 10, 100000)
    const pending = automation.getPendingRequests()
    expect(pending.map((r: { requestId: string }) => r.requestId)).toContain('r1')
    expect(pending.map((r: { requestId: string }) => r.requestId)).not.toContain('r2')
  })

  it('should block C grade data', () => {
    expect(() => automation.registerRequest('r1', 'X', 1, 1000, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    expect(() => automation.registerRequest('r1', 'X', 1, 1000, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    automation.registerRequest('r1', 'Monitor', 5, 2500000)
    expect(automation.getAuditLog().length).toBeGreaterThan(0)
  })
})
