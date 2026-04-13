// Plan SC: SVC-AI-ADV-R379
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicAuditAutomationV2 } from '../public-audit-automation-v2'

describe('PublicAuditAutomationV2', () => {
  let audit: PublicAuditAutomationV2

  beforeEach(() => {
    audit = new PublicAuditAutomationV2()
  })

  it('registerItem — 감사 로그에 item.register 기록', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    const log = audit.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('item.register')
  })

  it('getCategoryPassRate — 카테고리별 통과율 계산', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    audit.registerItem('item-2', '동의 절차', 'privacy', true)
    audit.registerItem('item-3', '암호화', 'security', true)
    audit.recordResult('item-1', true, '확인 완료')
    audit.recordResult('item-2', false, '미이행')
    audit.recordResult('item-3', true, '확인 완료')
    // privacy: 1/2 = 50%
    expect(audit.getCategoryPassRate('privacy')).toBe(50)
    // security: 1/1 = 100%
    expect(audit.getCategoryPassRate('security')).toBe(100)
  })

  it('getFailedRequiredItems — required+미통과 항목 반환', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    audit.registerItem('item-2', '동의 절차', 'privacy', false)  // not required
    audit.registerItem('item-3', '암호화', 'security', true)
    audit.recordResult('item-1', false, '미이행')
    audit.recordResult('item-2', false, '미이행')
    audit.recordResult('item-3', true, '확인 완료')
    const failed = audit.getFailedRequiredItems()
    expect(failed).toHaveLength(1)
    expect(failed[0]!.id).toBe('item-1')
  })

  it('getFailedRequiredItems — 결과 미입력 필수 항목도 포함', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    // 결과 기록 없음
    const failed = audit.getFailedRequiredItems()
    expect(failed).toHaveLength(1)
  })

  it('recordResult — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    expect(() => audit.recordResult('item-1', true, '확인', 'C')).toThrow('BLOCKED')
  })

  it('recordResult — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    audit.registerItem('item-1', '개인정보 처리방침', 'privacy', true)
    expect(() => audit.recordResult('item-1', true, '확인', 'S')).toThrow('N2SF N-05')
  })

  it('getCategoryPassRate — 없는 카테고리 0 반환', () => {
    expect(audit.getCategoryPassRate('nonexistent')).toBe(0)
  })

  it('recordResult — 없는 itemId 에러', () => {
    expect(() => audit.recordResult('nonexistent', true, '확인')).toThrow('itemId 없음')
  })
})
