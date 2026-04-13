// Plan SC: SVC-AI-ADV-R446
import { describe, it, expect, beforeEach } from 'vitest'
import { PolicyComplianceVerifierV2 } from '../policy-compliance-verifier-v2'

describe('PolicyComplianceVerifierV2', () => {
  let verifier: PolicyComplianceVerifierV2

  beforeEach(() => {
    verifier = new PolicyComplianceVerifierV2()
  })

  it('registerPolicy — 감사 로그에 policy.register 기록', () => {
    verifier.registerPolicy('p1', '개인정보 처리방침', 'privacy', true)
    expect(verifier.getAuditLog()[0]!.action).toBe('policy.register')
  })

  it('getComplianceRate — 기록 없을 때 100', () => {
    expect(verifier.getComplianceRate()).toBe(100)
  })

  it('getComplianceRate — 모두 pass 시 100', () => {
    verifier.registerPolicy('p1', '정책1', 'security', true)
    verifier.recordComplianceResult('p1', 'pass')
    expect(verifier.getComplianceRate()).toBe(100)
  })

  it('getComplianceRate — 혼합 결과 시 비율 계산', () => {
    verifier.registerPolicy('p1', '정책1', 'security', true)
    verifier.registerPolicy('p2', '정책2', 'privacy', false)
    verifier.recordComplianceResult('p1', 'pass')
    verifier.recordComplianceResult('p2', 'fail')
    expect(verifier.getComplianceRate()).toBe(50)
  })

  it('getNonCompliantMandatoryPolicies — 미준수 필수 정책 반환', () => {
    verifier.registerPolicy('p1', '필수정책', 'security', true)
    verifier.registerPolicy('p2', '선택정책', 'privacy', false)
    verifier.recordComplianceResult('p1', 'fail')
    verifier.recordComplianceResult('p2', 'fail')
    const noncompliant = verifier.getNonCompliantMandatoryPolicies()
    expect(noncompliant).toHaveLength(1)
    expect(noncompliant[0]!.policyId).toBe('p1')
  })

  it('getNonCompliantMandatoryPolicies — 기록 없는 필수 정책도 포함', () => {
    verifier.registerPolicy('p1', '필수정책', 'security', true)
    const noncompliant = verifier.getNonCompliantMandatoryPolicies()
    expect(noncompliant).toHaveLength(1)
  })

  it('recordComplianceResult — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    verifier.registerPolicy('p1', '정책', 'security', true)
    expect(() => verifier.recordComplianceResult('p1', 'pass', 'C')).toThrow('BLOCKED')
  })

  it('recordComplianceResult — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    verifier.registerPolicy('p1', '정책', 'security', true)
    expect(() => verifier.recordComplianceResult('p1', 'pass', 'S')).toThrow('N2SF N-05')
  })
})
