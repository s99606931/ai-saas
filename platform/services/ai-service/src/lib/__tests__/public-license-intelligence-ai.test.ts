import { describe, it, expect, beforeEach } from 'vitest'
import { PublicLicenseIntelligenceAi } from '../public-license-intelligence-ai'

describe('PublicLicenseIntelligenceAi', () => {
  let intelligence: PublicLicenseIntelligenceAi

  beforeEach(() => {
    intelligence = new PublicLicenseIntelligenceAi()
  })

  it('인허가 등록 후 조회 가능', () => {
    const license = intelligence.registerLicense('lic-1', '건축허가', ['신청서', '도면', '등기부'], 30)
    expect(license.licenseId).toBe('lic-1')
    expect(license.requiredDocuments).toHaveLength(3)
  })

  it('완비율 100%: 모든 서류 제출', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서', '도면'], 30)
    intelligence.submitApplication('lic-1', 'app-1', ['신청서', '도면'])
    expect(intelligence.getCompletionRate('lic-1')).toBe(100)
  })

  it('완비율 50%: 절반 제출', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서', '도면'], 30)
    intelligence.submitApplication('lic-1', 'app-1', ['신청서'])
    expect(intelligence.getCompletionRate('lic-1')).toBe(50)
  })

  it('신청 없으면 완비율 0', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서'], 30)
    expect(intelligence.getCompletionRate('lic-1')).toBe(0)
  })

  it('getMissingDocuments: 미제출 서류 반환', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서', '도면', '등기부'], 30)
    intelligence.submitApplication('lic-1', 'app-1', ['신청서'])
    const missing = intelligence.getMissingDocuments('lic-1')
    expect(missing).toContain('도면')
    expect(missing).toContain('등기부')
    expect(missing).not.toContain('신청서')
  })

  it('C등급 데이터 전송 차단', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서'], 30)
    expect(() => intelligence.submitApplication('lic-1', 'app-1', ['신청서'], 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서'], 30)
    expect(() => intelligence.submitApplication('lic-1', 'app-1', ['신청서'], 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    intelligence.registerLicense('lic-1', '건축허가', ['신청서'], 30)
    intelligence.submitApplication('lic-1', 'app-1', ['신청서'])
    const log = intelligence.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
