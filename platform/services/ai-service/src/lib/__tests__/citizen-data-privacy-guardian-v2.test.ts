import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenDataPrivacyGuardianV2 } from '../citizen-data-privacy-guardian-v2'

describe('CitizenDataPrivacyGuardianV2', () => {
  let svc: CitizenDataPrivacyGuardianV2
  beforeEach(() => { svc = new CitizenDataPrivacyGuardianV2() })

  it('FR-R630.1: register PII field', () => {
    svc.registerPiiField('ssn', 'ssn')
    expect(svc.listFields().length).toBe(1)
  })

  it('FR-R630.2: masks value to 16 hex chars', () => {
    svc.registerPiiField('name', 'name')
    const masked = svc.maskValue('name', '홍길동')
    expect(masked).toMatch(/^[a-f0-9]{16}$/)
  })

  it('FR-R630.3: blocks C grade', () => {
    svc.registerPiiField('name', 'name')
    expect(() => svc.maskValue('name', '홍길동', 'C')).toThrow('BLOCKED')
  })

  it('FR-R630.3: blocks S grade', () => {
    svc.registerPiiField('name', 'name')
    expect(() => svc.maskValue('name', '홍길동', 'S')).toThrow('BLOCKED')
  })

  it('FR-R630.4: stats reflect mask count', () => {
    svc.registerPiiField('name', 'name')
    svc.maskValue('name', 'a')
    svc.maskValue('name', 'b')
    expect(svc.getStats()[0]!.count).toBe(2)
  })

  it('FR-R630.5: audit log populated', () => {
    svc.registerPiiField('name', 'name')
    svc.maskValue('name', 'x')
    expect(svc.getAuditLog().some(e => e.action === 'MASK_VALUE')).toBe(true)
  })
})
