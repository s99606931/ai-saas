// Plan SC: SVC-AI-ADV-R348
import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudPolicyEnforcerAI } from '../multicloud-policy-enforcer-ai'

describe('MulticloudPolicyEnforcerAI', () => {
  let enforcer: MulticloudPolicyEnforcerAI

  beforeEach(() => {
    enforcer = new MulticloudPolicyEnforcerAI()
  })

  it('registerCloud — 감사 로그에 cloud.register 기록', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    const log = enforcer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('cloud.register')
    expect(log[0]!.detail).toBe('aws:cloud-1')
  })

  it('evaluateResource — 위반 없을 때 complianceScore=100', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    enforcer.registerPolicy('p-1', 'CPU 정책', 'cpu', 'high', 80)
    const result = enforcer.evaluateResource('cloud-1', 'cpu', 70) // 70 <= 80 → no violation
    expect(result.violations).toHaveLength(0)
    expect(result.complianceScore).toBe(100)
  })

  it('evaluateResource — critical 위반 시 complianceScore=75 (100-25)', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    enforcer.registerPolicy('p-1', 'CPU 정책', 'cpu', 'critical', 80)
    const result = enforcer.evaluateResource('cloud-1', 'cpu', 95)
    expect(result.violations).toHaveLength(1)
    expect(result.complianceScore).toBe(75)
  })

  it('evaluateResource — 복합 위반 시 점수 누적 차감', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    enforcer.registerPolicy('p-1', 'CPU 정책', 'cpu', 'high', 80)   // 위반 -15
    enforcer.registerPolicy('p-2', 'CPU 추가', 'cpu', 'medium', 70) // 위반 -8
    const result = enforcer.evaluateResource('cloud-1', 'cpu', 90)
    // violations: 2개, deduction: 15+8=23, score: 100-23=77
    expect(result.violations).toHaveLength(2)
    expect(result.complianceScore).toBe(77)
  })

  it('getComplianceScore — 평균 컴플라이언스 점수 계산', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    enforcer.registerPolicy('p-1', 'CPU 정책', 'cpu', 'high', 80)
    enforcer.evaluateResource('cloud-1', 'cpu', 90) // score=85 (100-15)
    enforcer.evaluateResource('cloud-1', 'cpu', 70) // score=100 (no violation)
    const avgScore = enforcer.getComplianceScore('cloud-1')
    // (85+100)/2 = 92.5 → Math.round = 93
    expect(avgScore).toBe(93)
  })

  it('evaluateResource — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    expect(() => enforcer.evaluateResource('cloud-1', 'cpu', 80, 'C')).toThrow('BLOCKED')
  })

  it('evaluateResource — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    expect(() => enforcer.evaluateResource('cloud-1', 'cpu', 80, 'S')).toThrow('N2SF N-05')
  })

  it('getComplianceScore — 평가 이력 없을 때 100 반환', () => {
    enforcer.registerCloud('cloud-1', 'AWS Seoul', 'aws')
    expect(enforcer.getComplianceScore('cloud-1')).toBe(100)
  })
})
