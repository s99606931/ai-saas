/**
 * Tests — SVC-AI-ADV-R158 Content Policy Enforcer
 */

import { describe, it, expect } from 'vitest'
import { ContentPolicyEnforcer, type PolicyRule } from '../content-policy-enforcer'

function makeEnforcer() {
  let t = 1_700_000_000_000
  return new ContentPolicyEnforcer({
    now: () => {
      t += 1
      return t
    },
  })
}

describe('ContentPolicyEnforcer', () => {
  it('정상 텍스트는 allowed=true 반환', () => {
    const e = makeEnforcer()
    const r = e.enforce('민원 접수 처리 절차를 안내드립니다.')
    expect(r.allowed).toBe(true)
    expect(r.violations).toHaveLength(0)
  })

  it('정치 주제 포함 시 high severity 위반 반환', () => {
    const e = makeEnforcer()
    const r = e.enforce('선거 결과에 대한 분석입니다.')
    expect(r.violations.length).toBeGreaterThanOrEqual(1)
    expect(r.violations[0]?.category).toBe('politics')
    expect(r.violations[0]?.severity).toBe('high')
  })

  it('critical severity 1건 포함 시 allowed=false', () => {
    const e = makeEnforcer()
    const r = e.enforce('폭력을 옹호하는 내용')
    expect(r.allowed).toBe(false)
    expect(r.violations.some((v) => v.severity === 'critical')).toBe(true)
  })

  it('비속어 포함 시 language issue 탐지', () => {
    const e = makeEnforcer()
    const r = e.enforce('이 바보 같은 시스템')
    expect(r.languageIssues.some((i) => i.type === 'profanity')).toBe(true)
  })

  it('addRule 후 enforce 에 반영된다', () => {
    const e = makeEnforcer()
    const rule: PolicyRule = {
      id: 'custom-1',
      category: 'custom',
      pattern: /금지단어/,
      severity: 'high',
    }
    e.addRule(rule)
    const r = e.enforce('이것은 금지단어 입니다')
    expect(r.violations.some((v) => v.ruleId === 'custom-1')).toBe(true)
  })

  it('removeRule 후 enforce 에 미반영', () => {
    const e = makeEnforcer()
    e.addRule({
      id: 'x',
      category: 'custom',
      pattern: /xxx/,
      severity: 'high',
    })
    e.removeRule('x')
    const r = e.enforce('xxx here')
    expect(r.violations.some((v) => v.ruleId === 'x')).toBe(false)
  })

  it('주민등록번호 패턴 critical 로 차단', () => {
    const e = makeEnforcer()
    const r = e.enforce('주민등록번호 900101-1234567 입니다')
    expect(r.allowed).toBe(false)
    expect(r.violations.some((v) => v.category === 'personal_info')).toBe(true)
  })

  it('C/S 등급은 차단된다', () => {
    const e = makeEnforcer()
    expect(() => e.enforce('안녕', 'C')).toThrow('grade_blocked')
    expect(() => e.enforce('안녕', 'S')).toThrow('grade_blocked')
  })

  it('통계는 호출 횟수와 차단 횟수를 집계한다', () => {
    const e = makeEnforcer()
    e.enforce('정상 텍스트')
    e.enforce('폭력 발언')
    const stats = e.getStats()
    expect(stats.totalChecks).toBe(2)
    expect(stats.totalBlocked).toBeGreaterThanOrEqual(1)
  })

  it('감사 로그가 기록된다', () => {
    const e = makeEnforcer()
    e.enforce('안녕')
    const log = e.getAuditLog()
    expect(log.map((l) => l.event)).toContain('enforced')
  })
})
