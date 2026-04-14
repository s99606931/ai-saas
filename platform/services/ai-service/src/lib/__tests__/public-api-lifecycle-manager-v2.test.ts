import { describe, it, expect, beforeEach } from 'vitest'
import { PublicApiLifecycleManagerV2 } from '../public-api-lifecycle-manager-v2'

describe('PublicApiLifecycleManagerV2', () => {
  let svc: PublicApiLifecycleManagerV2
  beforeEach(() => { svc = new PublicApiLifecycleManagerV2() })

  it('FR-R629.1: register API as active', () => {
    svc.registerApi('api1')
    expect(svc.getStage('api1')).toBe('active')
  })

  it('FR-R629.2: transition to deprecated', () => {
    svc.registerApi('api1')
    svc.transition('api1', 'deprecated', 30)
    expect(svc.getStage('api1')).toBe('deprecated')
  })

  it('FR-R629.2: blocks C grade', () => {
    svc.registerApi('api1')
    expect(() => svc.transition('api1', 'deprecated', 30, 'C')).toThrow('BLOCKED')
  })

  it('FR-R629.3: no retire candidates before timeout', () => {
    svc.registerApi('api1')
    svc.transition('api1', 'deprecated', 90)
    expect(svc.getRetireCandidates()).toHaveLength(0)
  })

  it('FR-R629.4: retire candidates after timeout', () => {
    svc.registerApi('api1')
    svc.transition('api1', 'deprecated', 1)
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    expect(svc.getRetireCandidates(future)).toHaveLength(1)
  })

  it('FR-R629.5: audit log populated', () => {
    svc.registerApi('api1')
    expect(svc.getAuditLog().some(e => e.action === 'REGISTER_API')).toBe(true)
  })
})
