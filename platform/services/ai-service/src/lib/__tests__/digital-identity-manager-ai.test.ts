import { describe, it, expect, beforeEach } from 'vitest'
import { DigitalIdentityManagerAi, type DigitalIdentity, type IdentityVerificationRequest } from '../digital-identity-manager-ai'

describe('DigitalIdentityManagerAi', () => {
  let manager: DigitalIdentityManagerAi

  const validIdentity: DigitalIdentity = {
    identityId: 'ID001',
    userId: 'USER001',
    orgId: 'ORG001',
    identityType: 'CITIZEN',
    verificationLevel: 'STRONG',
    attributes: [
      { key: 'name', value: '홍길동', sensitive: false },
      { key: 'ssn', value: '900101-1234567', sensitive: true },
      { key: 'email', value: 'hong@example.com', sensitive: false },
    ],
    issuedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
  }

  const request: IdentityVerificationRequest = {
    identityId: 'ID001',
    requestedAttributes: ['name', 'ssn', 'email'],
    requestorOrgId: 'ORG_GOV',
    purpose: '민원 처리',
  }

  beforeEach(() => {
    manager = new DigitalIdentityManagerAi()
    manager.registerIdentity(validIdentity)
  })

  it('아이덴티티 등록 감사 로그 (userId 마스킹)', () => {
    const log = manager.getAuditLog()
    const entry = log.find((e) => e.action === 'identity.register')!
    expect(entry).toBeTruthy()
    // 마스킹 확인: 원본 userId 'USER001' 미노출
    expect(entry.detail).not.toContain('USER001')
  })

  it('유효 아이덴티티 → isValid true, expiryStatus VALID', () => {
    const result = manager.verify(request)
    expect(result.isValid).toBe(true)
    expect(result.expiryStatus).toBe('VALID')
  })

  it('민감 속성 → maskedAttributes, 비민감 → disclosedAttributes', () => {
    const result = manager.verify(request)
    expect(result.maskedAttributes.some((a) => a.key === 'ssn')).toBe(true)
    expect(result.disclosedAttributes.some((a) => a.key === 'name')).toBe(true)
    expect(result.disclosedAttributes.some((a) => a.key === 'email')).toBe(true)
  })

  it('민감 속성 마스킹 형식 확인', () => {
    const result = manager.verify(request)
    const ssnMasked = result.maskedAttributes.find((a) => a.key === 'ssn')!
    // 첫 글자 + *** + 마지막 글자
    expect(ssnMasked.maskedValue[0]).toBeTruthy()
    expect(ssnMasked.maskedValue.includes('*')).toBe(true)
  })

  it('만료된 아이덴티티 → isValid false, expiryStatus EXPIRED', () => {
    const expiredIdentity: DigitalIdentity = {
      ...validIdentity,
      identityId: 'ID002',
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }
    manager.registerIdentity(expiredIdentity)
    const result = manager.verify({ ...request, identityId: 'ID002' })
    expect(result.isValid).toBe(false)
    expect(result.expiryStatus).toBe('EXPIRED')
  })

  it('30일 이내 만료 → expiryStatus EXPIRING_SOON', () => {
    const expiringIdentity: DigitalIdentity = {
      ...validIdentity,
      identityId: 'ID003',
      expiresAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    }
    manager.registerIdentity(expiringIdentity)
    const result = manager.verify({ ...request, identityId: 'ID003' })
    expect(result.expiryStatus).toBe('EXPIRING_SOON')
  })

  it('미등록 아이덴티티 에러', () => {
    expect(() => manager.verify({ ...request, identityId: 'UNKNOWN' })).toThrow()
  })

  it('검증 후 감사 로그', () => {
    manager.verify(request)
    const log = manager.getAuditLog()
    expect(log.some((e) => e.action === 'identity.verify')).toBe(true)
  })
})
