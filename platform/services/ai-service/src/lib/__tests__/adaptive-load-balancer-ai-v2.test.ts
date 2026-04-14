import { describe, it, expect, beforeEach } from 'vitest'
import { AdaptiveLoadBalancerAiV2 } from '../adaptive-load-balancer-ai-v2'

describe('AdaptiveLoadBalancerAiV2', () => {
  let svc: AdaptiveLoadBalancerAiV2
  beforeEach(() => {
    svc = new AdaptiveLoadBalancerAiV2()
    svc.registerBackend('b1', 100)
    svc.registerBackend('b2', 100)
  })

  it('FR-R636.1: register backend', () => {
    expect(svc.selectBackend()).not.toBeNull()
  })

  it('FR-R636.2: record load', () => {
    svc.recordLoad('b1', 50)
    expect(svc.getAuditLog().some(e => e.action === 'RECORD_LOAD')).toBe(true)
  })

  it('FR-R636.2: blocks C grade', () => {
    expect(() => svc.recordLoad('b1', 50, 'C')).toThrow('BLOCKED')
  })

  it('FR-R636.2: blocks S grade', () => {
    expect(() => svc.recordLoad('b1', 50, 'S')).toThrow('BLOCKED')
  })

  it('FR-R636.3: selects minimum-load backend', () => {
    svc.recordLoad('b1', 80)
    svc.recordLoad('b2', 20)
    expect(svc.selectBackend()).toBe('b2')
  })

  it('FR-R636.4: lists saturated backends', () => {
    svc.recordLoad('b1', 95)
    svc.recordLoad('b2', 10)
    expect(svc.getSaturatedBackends(90).map(b => b.backendId)).toEqual(['b1'])
  })

  it('FR-R636.5: audit log populated', () => {
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_BACKEND')).toBe(true)
  })
})
