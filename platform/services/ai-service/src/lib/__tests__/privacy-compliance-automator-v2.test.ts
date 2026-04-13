import { describe, it, expect, beforeEach } from 'vitest'
import { PrivacyComplianceAutomatorV2 } from '../privacy-compliance-automator-v2'

describe('PrivacyComplianceAutomatorV2', () => {
  let automator: PrivacyComplianceAutomatorV2

  beforeEach(() => {
    automator = new PrivacyComplianceAutomatorV2()
  })

  it('항목 등록 후 조회 가능', () => {
    const item = automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    expect(item.itemId).toBe('item-1')
    expect(item.consentRequired).toBe(true)
  })

  it('consentRequired 항목 없으면 준수율 100', () => {
    automator.registerItem('item-1', 'public', '공개 데이터', 365, false)
    expect(automator.getComplianceRate()).toBe(100)
  })

  it('항목 없으면 준수율 100', () => {
    expect(automator.getComplianceRate()).toBe(100)
  })

  it('동의 기록 후 준수율 계산', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    automator.registerItem('item-2', 'sensitive', '의료 서비스', 1825, true)
    automator.recordConsent('item-1', true)
    const rate = automator.getComplianceRate()
    expect(rate).toBe(50)
  })

  it('모든 항목 동의 시 준수율 100', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    automator.recordConsent('item-1', true)
    expect(automator.getComplianceRate()).toBe(100)
  })

  it('최신 동의 기록만 사용', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    automator.recordConsent('item-1', true)
    automator.recordConsent('item-1', false)
    expect(automator.getComplianceRate()).toBe(0)
  })

  it('getNonConsentItems: 동의 미완료 항목 반환', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    automator.registerItem('item-2', 'sensitive', '의료 서비스', 1825, true)
    automator.recordConsent('item-1', true)
    const nonConsent = automator.getNonConsentItems()
    expect(nonConsent.map((i) => i.itemId)).toContain('item-2')
    expect(nonConsent.map((i) => i.itemId)).not.toContain('item-1')
  })

  it('C등급 데이터 전송 차단', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    expect(() => automator.recordConsent('item-1', true, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    automator.registerItem('item-1', 'personal', '서비스 제공', 365, true)
    automator.recordConsent('item-1', true)
    const log = automator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
