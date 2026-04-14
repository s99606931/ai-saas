import { describe, it, expect, beforeEach } from 'vitest'
import { CrossDomainDataLinkerV2 } from '../cross-domain-data-linker-v2'

describe('CrossDomainDataLinkerV2', () => {
  let svc: CrossDomainDataLinkerV2
  beforeEach(() => {
    svc = new CrossDomainDataLinkerV2()
    svc.registerDomain('health', 'Health')
    svc.registerDomain('welfare', 'Welfare')
  })

  it('FR-R634.1: registers domains', () => {
    expect(() => svc.addLink('health', 'welfare', true)).not.toThrow()
  })

  it('FR-R634.2: blocks C grade', () => {
    expect(() => svc.addLink('health', 'welfare', true, 'C')).toThrow('BLOCKED')
  })

  it('FR-R634.2: blocks S grade', () => {
    expect(() => svc.addLink('health', 'welfare', true, 'S')).toThrow('BLOCKED')
  })

  it('FR-R634.3: match rate computation', () => {
    svc.addLink('health', 'welfare', true)
    svc.addLink('health', 'welfare', true)
    svc.addLink('health', 'welfare', false)
    expect(svc.matchRate('health', 'welfare')).toBeCloseTo(2 / 3, 5)
  })

  it('FR-R634.4: low match domains', () => {
    svc.addLink('health', 'welfare', false)
    svc.addLink('health', 'welfare', false)
    expect(svc.lowMatchDomains(0.5).length).toBe(1)
  })

  it('FR-R634.5: audit log populated', () => {
    svc.addLink('health', 'welfare', true)
    expect(svc.getAuditLog().some(e => e.action === 'ADD_LINK')).toBe(true)
  })
})
