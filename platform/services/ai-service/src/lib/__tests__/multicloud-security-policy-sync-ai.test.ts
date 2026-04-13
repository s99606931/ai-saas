// Plan SC: SVC-AI-ADV-R409
import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudSecurityPolicySyncAI } from '../multicloud-security-policy-sync-ai'

describe('MulticloudSecurityPolicySyncAI', () => {
  let sync: MulticloudSecurityPolicySyncAI

  beforeEach(() => {
    sync = new MulticloudSecurityPolicySyncAI()
  })

  it('registerCloud — 감사 로그에 cloud.register 기록', () => {
    sync.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    const log = sync.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('cloud.register')
  })

  it('getPolicyMismatches — 동일 정책 값이면 불일치 없음', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    sync.registerCloud('cloud-2', 'Azure', 'azure')
    sync.setPolicy('cloud-1', 'mfa_required', 'true')
    sync.setPolicy('cloud-2', 'mfa_required', 'true')
    expect(sync.getPolicyMismatches()).toHaveLength(0)
  })

  it('getPolicyMismatches — 값이 다르면 불일치 반환', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    sync.registerCloud('cloud-2', 'Azure', 'azure')
    sync.setPolicy('cloud-1', 'mfa_required', 'true')
    sync.setPolicy('cloud-2', 'mfa_required', 'false')
    const mismatches = sync.getPolicyMismatches()
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]!.policyType).toBe('mfa_required')
  })

  it('getPolicySyncStatus — syncRate 계산', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    sync.registerCloud('cloud-2', 'Azure', 'azure')
    sync.setPolicy('cloud-1', 'mfa_required', 'true')
    sync.setPolicy('cloud-2', 'mfa_required', 'true')  // synced
    sync.setPolicy('cloud-1', 'encryption', 'AES256')
    sync.setPolicy('cloud-2', 'encryption', 'AES128')  // mismatch
    const status = sync.getPolicySyncStatus()
    expect(status.totalPolicies).toBe(2)
    expect(status.syncedPolicies).toBe(1)
    expect(status.mismatchedPolicies).toBe(1)
    expect(status.syncRate).toBe(50)
  })

  it('setPolicy — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    expect(() => sync.setPolicy('cloud-1', 'mfa', 'true', 'C')).toThrow('BLOCKED')
  })

  it('setPolicy — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    expect(() => sync.setPolicy('cloud-1', 'mfa', 'true', 'S')).toThrow('N2SF N-05')
  })

  it('getPolicySyncStatus — 정책 없을 때 syncRate=100', () => {
    sync.registerCloud('cloud-1', 'AWS', 'aws')
    const status = sync.getPolicySyncStatus()
    expect(status.syncRate).toBe(100)
    expect(status.totalPolicies).toBe(0)
  })

  it('setPolicy — 없는 cloudId 에러', () => {
    expect(() => sync.setPolicy('nonexistent', 'mfa', 'true')).toThrow('cloudId 없음')
  })
})
