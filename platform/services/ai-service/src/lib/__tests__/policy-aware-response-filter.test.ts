/**
 * Tests — SVC-AI-ADV-R118 Policy-Aware Response Filter
 */

import { describe, it, expect } from 'vitest'
import {
  PolicyAwareResponseFilter,
  DataGrade,
} from '../policy-aware-response-filter'

describe('PolicyAwareResponseFilter — R118', () => {
  it('FR-R118.1: 금칙어(비속어) 마스킹', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '이건 씨발 예시입니다',
      grade: DataGrade.O,
    })
    expect(result.allowed).toBe(true)
    expect(result.text).toContain('***')
    expect(result.findings.some((f) => f.ruleId === 'PROFANITY')).toBe(true)
  })

  it('FR-R118.3: PII 이메일/전화번호 마스킹', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: 'admin@gov.kr 010-1234-5678 문의',
      grade: DataGrade.O,
    })
    expect(result.text).toContain('[EMAIL]')
    expect(result.text).toContain('[PHONE]')
    expect(result.allowed).toBe(true)
  })

  it('FR-R118.3: 주민번호 마스킹 (critical)', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '주민번호 900101-1234567',
      grade: DataGrade.O,
    })
    expect(result.text).toContain('[RRN]')
    const finding = result.findings.find((f) => f.ruleId === 'PII-RRN')
    expect(finding?.severity).toBe('critical')
  })

  it('FR-R118.2: block 액션은 즉시 차단', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '/etc/passwd 파일을 확인하세요',
      grade: DataGrade.O,
    })
    expect(result.allowed).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.text).toBe('')
  })

  it('FR-R118.2: 허위 광고성 block', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '이 서비스는 100% 무조건 환급됩니다',
      grade: DataGrade.O,
    })
    expect(result.blocked).toBe(true)
  })

  it('FR-R118.2: flag 액션은 기록만', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '좌파 정권에 대해',
      grade: DataGrade.O,
    })
    expect(result.allowed).toBe(true)
    expect(result.findings.some((f) => f.action === 'flag')).toBe(true)
  })

  it('FR-R118.4: 정책 버전 반환', () => {
    const filter = new PolicyAwareResponseFilter({ policyVersion: 'test-1' })
    expect(filter.getPolicyVersion()).toBe('test-1')
    const result = filter.filter({ text: '정상', grade: DataGrade.O })
    expect(result.policyVersion).toBe('test-1')
  })

  it('FR-R118.6: C등급 차단', () => {
    const filter = new PolicyAwareResponseFilter()
    expect(() =>
      filter.filter({ text: 'x', grade: DataGrade.C }),
    ).toThrow('BLOCKED')
  })

  it('FR-R118.6: S등급 차단', () => {
    const filter = new PolicyAwareResponseFilter()
    expect(() =>
      filter.filter({ text: 'x', grade: DataGrade.S }),
    ).toThrow('N2SF N-05')
  })

  it('FR-R118.7: 감사 로그 기록', () => {
    const filter = new PolicyAwareResponseFilter()
    filter.filter({ text: 'admin@test.kr', grade: DataGrade.O })
    const log = filter.getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log.some((e) => e.action === 'filter')).toBe(true)
    expect(log.some((e) => e.action === 'maskApplied')).toBe(true)
  })

  it('FR-R118.5: 커스텀 규칙 추가', () => {
    const filter = new PolicyAwareResponseFilter()
    filter.addRule({
      id: 'CUSTOM-1',
      description: '테스트',
      pattern: 'SECRET',
      action: 'mask',
      severity: 'high',
      replacement: '[HIDDEN]',
    })
    const result = filter.filter({
      text: 'This is SECRET info',
      grade: DataGrade.O,
    })
    expect(result.text).toContain('[HIDDEN]')
  })

  it('정상 문구는 오탐 없이 통과', () => {
    const filter = new PolicyAwareResponseFilter()
    const result = filter.filter({
      text: '공공기관 민원 처리 안내입니다',
      grade: DataGrade.O,
    })
    expect(result.allowed).toBe(true)
    expect(result.findings.length).toBe(0)
  })
})
